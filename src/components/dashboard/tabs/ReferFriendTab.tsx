import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Share2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  REFERRAL_TERMS_PATH, REFERRAL_PAGE_PATH, referralLink, referralStatusLabel, referralReasonLabel, formatReward,
} from "@/lib/referral/terms";

type Reward = {
  ref: string; role: "referrer" | "friend" | "goodwill"; status: string; amount: number; amount_basis: "gross" | "net";
  on_hold: boolean; live_at: string | null; booked_at: string | null; expires_at: string | null; qualifies_from: string | null;
  balance_minor: number; terms_version: string; reason: string | null; created_at: string;
};
type Movement = { kind: string; amount_minor: number; reward_ref: string; invoice_number: string | null; at: string };
type Overview = {
  ok: boolean; enabled: boolean; code: string | null; balance_minor: number;
  terms: { version: string; summary: string; url: string } | null;
  rewards: Reward[]; history: Movement[];
};

const rpc = supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const money = (minor: number) => `£${(minor / 100).toFixed(2)}`;
const date = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }) : "";

const CODE_ERRORS: Record<string, string> = {
  scheme_not_open: "Refer a friend isn't open yet.",
  needs_live_service: "You need a live OCCTA service to get a code.",
  account_not_up_to_date: "Your account needs to be up to date with payments for the last 90 days to get a code.",
};

const MOVEMENT_LABEL: Record<string, string> = {
  booked: "Credit added", applied: "Used on bill", unapplied: "Returned from cancelled bill",
  expired: "Expired", reversed: "Withdrawn", clawed_back: "Unused credit removed",
};

export default function ReferFriendTab() {
  const { toast } = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: d } = await rpc("referral_my_overview");
    setData((d as Overview) ?? null);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const getCode = async () => {
    setIssuing(true); setCodeError(null);
    const { data: d, error } = await rpc("referral_my_code");
    setIssuing(false);
    const res = d as { ok?: boolean; error?: string } | null;
    if (error || !res?.ok) { setCodeError(CODE_ERRORS[res?.error ?? ""] ?? "We couldn't create your code. Please try again later."); return; }
    toast({ title: "Your code is ready", description: "We've also emailed it to you with the terms." });
    void load();
  };

  if (loading) return <div className="flex items-center gap-2 p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (!data?.ok || !data.enabled && !data.code && !(data.rewards?.length)) {
    return <div className="border-4 border-foreground p-6 text-sm">Refer a friend isn't open yet. We'll let you know when it is.</div>;
  }

  const link = data.code ? referralLink(data.code) : null;
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: `${what} copied` }); } catch { toast({ title: "Couldn't copy", description: text }); }
  };
  const share = async () => {
    if (!link) return;
    const text = `I'm with OCCTA for broadband. Use my link or code ${data.code} when you order. Terms apply.`;
    if (navigator.share) { try { await navigator.share({ title: "OCCTA", text, url: link }); return; } catch { /* cancelled */ } }
    void copy(`${text} ${link}`, "Message");
  };

  const myReferrals = data.rewards.filter((r) => r.role === "referrer");
  const other = data.rewards.filter((r) => r.role !== "referrer");

  return (
    <div className="space-y-6">
      <section className="border-4 border-foreground p-4 sm:p-6">
        <h2 className="font-display uppercase text-xl">Refer a friend</h2>
        <p className="mt-2 text-sm leading-relaxed">{data.terms?.summary}</p>
        <p className="mt-2 text-xs">
          <Link to={REFERRAL_TERMS_PATH} className="underline">Full terms</Link> (version {data.terms?.version}) ·{" "}
          <Link to={REFERRAL_PAGE_PATH} className="underline">How it works</Link>
        </p>

        {data.code && link ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-2xl tracking-widest border-2 border-foreground px-3 py-1" data-testid="referral-code">{data.code}</span>
              <Button variant="outline" size="sm" onClick={() => copy(data.code!, "Code")}><Copy className="h-4 w-4 mr-1" />Copy code</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs break-all border-2 border-border px-2 py-1 max-w-full">{link}</span>
              <Button variant="outline" size="sm" onClick={() => copy(link, "Link")}><Copy className="h-4 w-4 mr-1" />Copy link</Button>
              <Button size="sm" onClick={share}><Share2 className="h-4 w-4 mr-1" />Share</Button>
            </div>
            <p className="text-xs text-muted-foreground">Your friend must use your link or type your code before they place their order. Please don't post it in paid adverts or spam it.</p>
          </div>
        ) : (
          <div className="mt-4">
            <Button onClick={getCode} disabled={issuing}>{issuing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Get my code</Button>
            {codeError && <p className="mt-2 text-sm text-destructive">{codeError}</p>}
          </div>
        )}
      </section>

      <section className="border-4 border-foreground p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display uppercase">Your bill credit</h3>
          <span className="font-display text-2xl" data-testid="referral-balance">{money(data.balance_minor)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Taken off your next bills automatically. Never paid as cash.</p>
        {data.history.length > 0 && (
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-left text-xs uppercase"><th className="py-1">Date</th><th>What</th><th>Ref</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {data.history.map((m, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1">{date(m.at)}</td>
                  <td>{MOVEMENT_LABEL[m.kind] ?? m.kind}{m.invoice_number ? ` (${m.invoice_number})` : ""}</td>
                  <td className="text-xs">{m.reward_ref}</td>
                  <td className="text-right">{m.kind === "booked" || m.kind === "unapplied" ? "+" : "−"}{money(m.amount_minor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="border-4 border-foreground p-4 sm:p-6">
        <h3 className="font-display uppercase">Your referrals</h3>
        {myReferrals.length === 0 && other.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No referrals yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {[...myReferrals, ...other].map((r) => {
              const s = referralStatusLabel(r.status, r.role);
              const why = referralReasonLabel(r.reason);
              return (
                <li key={r.ref} className="border-2 border-border p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-display">
                      {r.role === "referrer" ? "Friend referred" : r.role === "friend" ? "Welcome credit (you were referred)" : "Goodwill credit"} · {formatReward(Number(r.amount), r.amount_basis)}
                    </span>
                    <span className={s.tone === "bad" ? "text-destructive" : s.tone === "good" ? "text-primary" : ""}>{r.on_hold ? "On hold while we check something" : s.label}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Ref {r.ref} · started {date(r.created_at)}
                    {r.qualifies_from && ["pending", "qualifying"].includes(r.status) ? ` · earliest check ${date(r.qualifies_from)}` : ""}
                    {r.expires_at && ["booked", "partly_applied"].includes(r.status) ? ` · use by ${date(r.expires_at)}` : ""}
                    {why ? ` · ${why}` : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Think a referral is missing or a decision is wrong? <Link to="/support" className="underline">Contact us</Link> and we'll review the evidence.
        </p>
      </section>
    </div>
  );
}
