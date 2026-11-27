import { describe, expect, it } from "vitest";
import {
  detectAccountIntent,
  extractAccountNumber,
  extractDateOfBirth,
  type CompanionMessage,
} from "../../../../supabase/functions/_shared/companionCore";

// Replays the 26 Nov 2026 chat where a prospect asking about a router was stuck
// in a loop of "what's your account number?". The server now looks only at the
// LATEST message to decide whether a turn is an account request, and only runs
// verification when that message actually contains an account number or DOB.
const latest = (text: string): CompanionMessage[] => [{ role: "user", content: text }];
const wouldVerify = (history: CompanionMessage[]) => {
  const last = history.filter((m) => m.role === "user").at(-1)!.content;
  const justGiven = Boolean(extractAccountNumber(latest(last)) || extractDateOfBirth(latest(last)));
  return justGiven && Boolean(extractAccountNumber(history)) && Boolean(extractDateOfBirth(history));
};

describe("Ollie never traps prospects in verification", () => {
  it("follow-ups after 'I don't have an account' are not account requests", () => {
    for (const text of ["I can't find it", "I see this isnt agreat ai", "Raise a compatibility ticket", "could i use my GL.iNet GL-SFT1200 router"]) {
      expect(detectAccountIntent(latest(text)), text).toBeNull();
    }
  });

  it("the replayed conversation never triggers verification", () => {
    const history: CompanionMessage[] = [];
    for (const text of [
      "could i use my GL.iNet GL-SFT1200 Opal Travel Router",
      "Raise a compatibility ticket",
      "well... i dont have an account... cause i cant sign up without knowing the answer....",
      "I can't find it",
      "I see this isnt agreat ai",
    ]) {
      history.push({ role: "user", content: text }, { role: "assistant", content: "…" });
      expect(wouldVerify(history), text).toBe(false);
    }
  });

  it("a real customer giving account number then date of birth is verified", () => {
    const history: CompanionMessage[] = [
      { role: "user", content: "Explain my latest bill" },
      { role: "assistant", content: "…" },
      { role: "user", content: "OCC12345678" },
      { role: "assistant", content: "…" },
      { role: "user", content: "14/03/1985" },
    ];
    expect(wouldVerify(history)).toBe(true);
    expect(detectAccountIntent(latest("Explain my latest bill"))).toBe("invoices");
  });
});
