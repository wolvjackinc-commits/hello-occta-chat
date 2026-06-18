import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertTriangle, LifeBuoy, Loader2, ShieldCheck } from "lucide-react";

type Json = Record<string, unknown>;

export type CardPayload =
  | ({ type: "confirmation_card"; action_type: string; target_id: string; summary: string; warning?: string; details?: Json })
  | ({ type: "escalation_card"; reference: string; subject: string; priority?: string; message: string })
  | ({ type: "status_card"; title: string; rows: { label: string; value: string }[]; tone?: "info" | "success" | "warning" });

// Extract <<<CARD:{...}>>> blocks from assistant text. Returns the text without cards + the parsed cards.
export function extractCards(content: string): { text: string; cards: CardPayload[] } {
  const cards: CardPayload[] = [];
  const re = /<<<CARD:([\s\S]*?)>>>/g;
  const text = content.replace(re, (_, raw) => {
    try {
      const parsed = JSON.parse(raw.trim());
      if (parsed && typeof parsed === "object" && typeof parsed.type === "string") {
        cards.push(parsed as CardPayload);
      }
    } catch {
      /* ignore malformed cards */
    }
    return "";
  });
  return { text: text.trim(), cards };
}

export function CardRenderer({ card }: { card: CardPayload }) {
  if (card.type === "confirmation_card") return <ConfirmationCard card={card} />;
  if (card.type === "escalation_card") return <EscalationCard card={card} />;
  if (card.type === "status_card") return <StatusCard card={card} />;
  return null;
}

function ConfirmationCard({ card }: { card: Extract<CardPayload, { type: "confirmation_card" }> }) {
  const { toast } = useToast();
  const [state, setState] = useState<"idle" | "running" | "done" | "cancelled" | "error">("idle");
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const confirm = async () => {
    setState("running");
    try {
      const { data, error } = await supabase.functions.invoke("ai-execute-action", {
        body: {
          action_type: card.action_type,
          target_id: card.target_id,
          details: card.details ?? {},
          confirmed: true,
        },
      });
      if (error) throw error;
      const msg = (data as { result?: { message?: string } })?.result?.message ?? "Action completed.";
      setResultMsg(msg);
      setState("done");
      toast({ title: "Action recorded", description: msg });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Action failed.";
      setResultMsg(msg);
      setState("error");
      toast({ title: "Action failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="mt-2 border-2 border-foreground bg-background p-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <span className="font-display uppercase text-xs">Confirm action</span>
        <Badge variant="outline" className="ml-auto capitalize">{card.action_type.replace(/_/g, " ")}</Badge>
      </div>
      <p className="mb-2">{card.summary}</p>
      <p className="text-xs text-muted-foreground mb-3">Target: <code>{card.target_id}</code></p>
      {card.warning && (
        <div className="flex items-start gap-2 text-xs bg-secondary p-2 mb-3 border border-foreground/30">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{card.warning}</span>
        </div>
      )}
      {state === "idle" && (
        <div className="flex gap-2">
          <Button size="sm" variant="hero" onClick={confirm}>Confirm</Button>
          <Button size="sm" variant="outline" onClick={() => setState("cancelled")}>Cancel</Button>
        </div>
      )}
      {state === "running" && (
        <div className="flex items-center gap-2 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Running…</div>
      )}
      {state === "done" && (
        <div className="flex items-center gap-2 text-xs text-primary"><CheckCircle2 className="w-3 h-3" /> {resultMsg}</div>
      )}
      {state === "cancelled" && <p className="text-xs text-muted-foreground">Cancelled. No changes made.</p>}
      {state === "error" && <p className="text-xs text-destructive">{resultMsg}</p>}
    </div>
  );
}

function EscalationCard({ card }: { card: Extract<CardPayload, { type: "escalation_card" }> }) {
  return (
    <div className="mt-2 border-2 border-foreground bg-background p-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <LifeBuoy className="w-4 h-4 text-primary" />
        <span className="font-display uppercase text-xs">Case raised</span>
        <Badge variant="outline" className="ml-auto">Ref {card.reference}</Badge>
      </div>
      <p className="font-medium">{card.subject}</p>
      <p className="text-xs text-muted-foreground mt-1">{card.message}</p>
      {card.priority && <p className="text-[10px] uppercase tracking-wider mt-2">Priority: {card.priority}</p>}
    </div>
  );
}

function StatusCard({ card }: { card: Extract<CardPayload, { type: "status_card" }> }) {
  return (
    <div className="mt-2 border-2 border-foreground bg-background p-3 text-sm">
      <p className="font-display uppercase text-xs mb-2">{card.title}</p>
      <div className="space-y-1">
        {card.rows.map((r, i) => (
          <div key={i} className="flex justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-medium text-right">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
