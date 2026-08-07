import { describe, expect, it } from "vitest";
import type { CompanionMessage } from "../../../supabase/functions/_shared/companionCore.ts";
import {
  isExplicitHumanRequest,
  resolveIntelligentPublicReply,
  shouldOfferHuman,
  verificationFailureFallback,
} from "./ollieIntelligence";

const convo = (...rows: Array<["user" | "assistant", string]>): CompanionMessage[] =>
  rows.map(([role, content]) => ({ role, content }));

describe("Ollie V3 transcript-driven intelligence", () => {
  it("answers a natural plans question instead of refusing", () => {
    const reply = resolveIntelligentPublicReply(convo(["user", "what are your plans?"]));
    expect(reply).toContain("Essential Fibre");
    expect(reply).toContain("Superfast Fibre");
    expect(reply).toContain("Ultrafast Fibre");
    expect(reply).not.toContain("don't have enough verified information");
  });

  it("answers whether OCCTA has fast internet without guessing address availability", () => {
    const reply = resolveIntelligentPublicReply(convo(["user", "do you have fast internet?"]));
    expect(reply).toContain("1,000Mbps");
    expect(reply).toMatch(/address supports|exact address/i);
  });

  it("handles reputation questions transparently rather than self-rating", () => {
    const reply = resolveIntelligentPublicReply(convo(["user", "is occta good or bad?"]));
    expect(reply).toMatch(/shouldn't pretend|independent reviewer/i);
    expect(reply).toMatch(/price|speed|support/i);
  });

  it("breaks out of the pre-order account-verification loop", () => {
    const reply = resolveIntelligentPublicReply(convo(
      ["user", "how long it will take to get my order processed?"],
      ["assistant", "What is your OCCTA account number?"],
      ["user", "i have not placed any order yet."],
    ));
    expect(reply).toMatch(/haven't placed an order yet/i);
    expect(reply).toMatch(/address check/i);
    expect(reply).not.toMatch(/account number/i);
  });

  it("does not repeat DOB verification after a failed attempt", () => {
    const reply = resolveIntelligentPublicReply(convo(
      ["user", "How much was my last bill?"],
      ["assistant", "I couldn't verify those details. Check the account number and date of birth."],
      ["user", "the details i have provided you is correct."],
    ));
    expect(reply).toMatch(/not going to keep asking/i);
    expect(reply).toMatch(/registered on the OCCTA account/i);
  });

  it("gives useful dashboard login recovery rather than immediately escalating", () => {
    const reply = resolveIntelligentPublicReply(convo(["user", "Dashboard not working won’t login"]));
    expect(reply).toMatch(/reset password|forgot\/reset password/i);
    expect(reply).toContain("/auth");
  });

  it("does not invent support opening hours", () => {
    const reply = resolveIntelligentPublicReply(convo(["user", "What are your support hours?"]));
    expect(reply).toMatch(/don't want to invent opening hours/i);
    expect(reply).toContain("/support");
  });

  it("does not invent call setup fees", () => {
    const reply = resolveIntelligentPublicReply(convo(["user", "what are the call setup fee?"]));
    expect(reply).toMatch(/won't make up/i);
    expect(reply).toMatch(/current tariff|price information/i);
  });

  it("keeps the human option out of the first support turn", () => {
    const messages = convo(["user", "my internet is not working"]);
    expect(shouldOfferHuman(messages)).toBe(false);
  });

  it("makes human escalation available after repeated unresolved attempts", () => {
    const messages = convo(
      ["user", "my internet is not working"],
      ["assistant", "Check the router lights and tell me what you see."],
      ["user", "I tried that and it is still not working"],
    );
    expect(shouldOfferHuman(messages)).toBe(true);
  });

  it("always respects an explicit request for a human", () => {
    expect(isExplicitHumanRequest("I'd like to speak to a human support advisor please")).toBe(true);
  });

  it("provides a non-looping secure verification fallback", () => {
    const reply = verificationFailureFallback();
    expect(reply).toMatch(/won't keep asking/i);
    expect(reply).toMatch(/registered on the OCCTA account/i);
  });
});
