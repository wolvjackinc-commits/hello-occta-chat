import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, ShieldCheck } from "lucide-react";

const MESSAGES: Record<string, string> = {
  incorrect_code: "The verification code is incorrect.",
  expired: "The verification code has expired. Please request another code.",
  too_soon: "Please wait before requesting another code.",
  send_limit_reached: "You have requested too many codes. Please try again later.",
  attempts_exceeded: "Too many attempts. Please request a new code.",
  invalid_mobile: "We don't have a valid UK mobile number for this order. Please go back and update your details.",
  mobile_changed: "Your mobile number has changed. Please request a new code.",
  provider_unavailable: "We could not send the code at the moment. Please try again.",
  already_signed: "This agreement has already been signed.",
};

function friendly(code?: string | null) {
  if (!code) return "Something went wrong. Please try again.";
  return MESSAGES[code] ?? "Something went wrong. Please try again.";
}

/**
 * Mobile OTP verification shown immediately before the electronic signature.
 * Used by both Customer Journey 1 and Customer Journey 2.0 (shared signing step).
 */
export default function ContractSmsVerification({
  token,
  onVerifiedChange,
  onChangeNumber,
}: {
  token: string;
  onVerifiedChange: (verified: boolean) => void;
  onChangeNumber?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [required, setRequired] = useState(true);
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);
  const inFlight = useRef(false);

  const setVerifiedState = useCallback((v: boolean) => {
    setVerified(v);
    onVerifiedChange(v);
  }, [onVerifiedChange]);

  // Load status (survives a page refresh mid-verification).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: fnErr } = await supabase.functions.invoke("send-contract-otp", {
        body: { token, action: "status" },
      });
      if (cancelled) return;
      const d = data as Record<string, unknown> | null;
      if (fnErr || !d || d.error) {
        setError(friendly((d?.error as string) ?? null));
      } else {
        setRequired(d.required !== false);
        setPhoneMasked((d.phone_masked as string) ?? null);
        setChallengeId((d.challenge_id as string) ?? null);
        setResendIn(Number(d.resend_in ?? 0));
        setExpiresIn(Number(d.expires_in ?? 0));
        if (d.verified === true) setVerifiedState(true);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token, setVerifiedState]);

  // Countdowns
  useEffect(() => {
    if (resendIn <= 0 && expiresIn <= 0) return;
    const t = setInterval(() => {
      setResendIn((s) => (s > 0 ? s - 1 : 0));
      setExpiresIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [resendIn, expiresIn]);

  const send = async () => {
    if (inFlight.current || sending || verified || resendIn > 0) return;
    inFlight.current = true;
    setSending(true); setError(null); setNotice(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("send-contract-otp", {
        body: { token, action: "send" },
      });
      const d = data as Record<string, unknown> | null;
      if (fnErr || !d || d.error) {
        setError(friendly((d?.error as string) ?? null));
        if (Number(d?.retry_after ?? 0) > 0) setResendIn(Number(d?.retry_after));
        return;
      }
      if (d.already_verified === true) { setVerifiedState(true); return; }
      setChallengeId((d.challenge_id as string) ?? null);
      setPhoneMasked((d.phone_masked as string) ?? phoneMasked);
      setExpiresIn(Number(d.expires_in ?? 600));
      setResendIn(Number(d.resend_in ?? 60));
      setNotice(d.resent === true ? "We have resent your verification code." : `Enter the six-digit code sent to ${(d.phone_masked as string) ?? "your mobile"}.`);
    } catch {
      setError(friendly("provider_unavailable"));
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  };

  const verify = async () => {
    if (inFlight.current || verifying || verified || !challengeId || code.length !== 6) return;
    inFlight.current = true;
    setVerifying(true); setError(null); setNotice(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("verify-contract-otp", {
        body: { token, challenge_id: challengeId, passcode: code },
      });
      const d = data as Record<string, unknown> | null;
      if (fnErr || !d || d.error) {
        setError(friendly((d?.error as string) ?? null));
        return;
      }
      setCode("");
      setVerifiedState(true);
      setNotice("Mobile number verified.");
    } catch {
      setError(friendly("provider_unavailable"));
    } finally {
      setVerifying(false);
      inFlight.current = false;
    }
  };

  if (loading) {
    return (
      <div className="border-2 border-foreground/30 p-4 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking mobile verification…
      </div>
    );
  }

  if (!required) {
    return (
      <div className="border-2 border-dashed border-foreground/40 p-4 text-xs text-muted-foreground">
        Mobile verification is temporarily unavailable. You can continue to sign your agreement.
      </div>
    );
  }

  return (
    <div className="border-2 border-foreground p-4 space-y-3">
      <div className="flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-display uppercase text-sm">Verify your mobile number</p>
          <p className="text-xs text-muted-foreground">
            {verified
              ? `Mobile number verified (${phoneMasked ?? ""}).`
              : `We will text a six-digit code to ${phoneMasked ?? "your mobile"}.`}
          </p>
        </div>
      </div>

      {verified ? (
        <p className="text-sm flex items-center gap-2 text-foreground">
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Mobile number verified.
        </p>
      ) : (
        <div className="space-y-3">
          {!challengeId ? (
            <Button type="button" variant="secondary" className="font-display uppercase" onClick={send} disabled={sending}>
              {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : "Send verification code"}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
                <div>
                  <Label htmlFor="otp-code">Six-digit code</Label>
                  <Input
                    id="otp-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    aria-describedby="otp-help"
                  />
                </div>
                <Button type="button" className="font-display uppercase" onClick={verify} disabled={verifying || code.length !== 6}>
                  {verifying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying…</> : "Verify code"}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={send}
                  disabled={sending || resendIn > 0}
                  className="underline disabled:no-underline disabled:text-muted-foreground"
                >
                  {resendIn > 0 ? `Resend code (${resendIn}s)` : "Resend code"}
                </button>
                {expiresIn > 0 && (
                  <span className="text-muted-foreground">
                    Code expires in {Math.floor(expiresIn / 60)}:{String(expiresIn % 60).padStart(2, "0")}
                  </span>
                )}
                {expiresIn === 0 && <span className="text-muted-foreground">Your code has expired — request another.</span>}
              </div>
            </div>
          )}
        </div>
      )}

      <p id="otp-help" className="text-[11px] text-muted-foreground" aria-live="polite">
        {error ?? notice ?? "We verify the mobile number from your order details before you sign."}
      </p>

      {onChangeNumber && !verified && (
        <button type="button" onClick={onChangeNumber} className="text-xs underline text-muted-foreground">
          Change mobile number
        </button>
      )}
    </div>
  );
}