import { describe, it, expect } from "vitest";
import { parseTranscriptFile } from "../sales";
describe("zoom vtt", () => { it("parses", () => {
  const v = "WEBVTT\n\n1\n00:00:01.020 --> 00:00:04.000\nAnn Agent: Hello, it's Ann from OCCTA.\n\n2\n00:01:05.500 --> 00:01:07.000\nRaj Patel: Yes that's fine.\n";
  expect(parseTranscriptFile(v)).toBe("[00:01] Ann Agent: Hello, it's Ann from OCCTA.\n[01:05] Raj Patel: Yes that's fine.");
}); });
