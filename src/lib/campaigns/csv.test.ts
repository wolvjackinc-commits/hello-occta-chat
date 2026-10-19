import { describe, it, expect } from "vitest";
import { parseCampaignCsv, toCampaignCsv, safeCsvCell } from "./csv";
describe("OCCTA campaign CSV import/export",()=>{
 it("parses comma, multiline, BOM and quoted values",()=>{
  const data=parseCampaignCsv('\uFEFFemail,full_name,company,tags,consent_at\r\nhello@example.com,"Ada, Lovelace","UK\nLtd",test;newsletter,2026-10-01');
  expect(data).toEqual([{email:"hello@example.com",full_name:"Ada, Lovelace",company:"UK\nLtd",tags:["test","newsletter"],consent_at:"2026-10-01"}]);
 });
 it("rejects missing email column and unclosed quote",()=>{
  expect(()=>parseCampaignCsv("name\nAlex")).toThrow("email");
  expect(()=>parseCampaignCsv('email,name\nme@example.com,"Alex')).toThrow("unclosed");
 });
 it("guards spreadsheet export from formula injection",()=>{
  for(const value of ["=SUM(1,1)","+cmd","-2","@evil","\tSUM"]){
   expect(safeCsvCell(value).startsWith('"\'')).toBe(true);
  }
  const output=toCampaignCsv(["email","status"],[["x@example.com","sent"]]);
  expect(output).toContain("x@example.com");
 });
 it("does not accept blank/headers-only lists",()=>{
  expect(()=>parseCampaignCsv("email,full_name")).toThrow("no contact");
 });
});
