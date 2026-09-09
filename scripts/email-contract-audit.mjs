import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const supportedTypes = new Set([
  "order_confirmation",
  "welcome",
  "status_update",
  "order_message",
  "ticket_reply",
  "password_reset",
  "invoice_sent",
  "invoice_paid",
  "payment_link",
  "invoice_external_payment",
  "custom_admin",
  "service_live_welcome",
  "sim_lifecycle",
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

const files = [
  ...walk(path.join(root, "src")),
  ...walk(path.join(root, "supabase", "functions")),
];

const failures = [];
let invokeCount = 0;

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file).replaceAll("\\", "/");
  const matcher = /functions\.invoke\(\s*["']send-email["']/g;
  let match;
  while ((match = matcher.exec(source))) {
    invokeCount += 1;
    const next = source.search.call(source.slice(match.index + match[0].length), /functions\.invoke\(\s*["']send-email["']/);
    const end = next >= 0
      ? match.index + match[0].length + Math.min(next, 2200)
      : Math.min(source.length, match.index + 2200);
    const window = source.slice(match.index, end);

    const literalBody = window.match(/body\s*:\s*\{[\s\S]*?\btype\s*:\s*["']([^"']+)["']/);
    if (literalBody) {
      if (!supportedTypes.has(literalBody[1])) {
        failures.push(`${rel}: unsupported send-email type '${literalBody[1]}'`);
      }
      continue;
    }

    const variableBody = window.match(/body\s*:\s*([A-Za-z_$][\w$]*)/);
    if (variableBody) {
      const variable = variableBody[1];
      const declaration = new RegExp(`(?:const|let|var)\\s+${variable}\\s*=\\s*\\{[\\s\\S]{0,1800}?\\btype\\s*:\\s*["']([^"']+)["']`).exec(source);
      if (!declaration) {
        failures.push(`${rel}: send-email body '${variable}' has no statically verifiable supported type`);
      } else if (!supportedTypes.has(declaration[1])) {
        failures.push(`${rel}: unsupported send-email type '${declaration[1]}' in '${variable}'`);
      }
      continue;
    }

    failures.push(`${rel}: send-email call has no statically verifiable type`);
  }

  // Direct fetches to the edge endpoint must also include a supported type.
  if (source.includes("/functions/v1/send-email")) {
    const typeMatches = [...source.matchAll(/\btype\s*:\s*["']([^"']+)["']/g)].map((m) => m[1]);
    if (!typeMatches.some((t) => supportedTypes.has(t))) {
      failures.push(`${rel}: direct send-email fetch has no supported type`);
    }
  }
}

const critical = [
  ["supabase/functions/submit-quote-request/index.ts", (s) => count(s, "sendTrackedCommunication(") >= 2, "customer + admin quote emails"],
  ["supabase/functions/submit-build-plan/index.ts", (s) => count(s, "sendTrackedCommunication(") >= 2, "customer + admin build-plan emails"],
  ["supabase/functions/submit-business-quote/index.ts", (s) => count(s, 'functions.invoke("send-email"') >= 2 && s.includes("to: quote.email"), "customer + admin business quote emails"],
  ["supabase/functions/submit-business-lead/index.ts", (s) => count(s, 'functions.invoke("send-email"') >= 2 && s.includes("to: lead.email"), "customer + admin business lead emails"],
  ["supabase/functions/submit-marketing-lead/index.ts", (s) => count(s, 'functions.invoke("send-email"') >= 2 && s.includes("to: email"), "customer + admin marketing lead emails"],
  ["supabase/functions/submit-support-ticket/index.ts", (s) => count(s, "sendTrackedCommunication(") >= 2, "customer + admin support-ticket emails"],
  ["supabase/functions/submit-vulnerable-support/index.ts", (s) => count(s, "sendTrackedCommunication(") >= 2 && !s.includes("emailBody: need"), "privacy-safe customer + admin vulnerable-support emails"],
  ["supabase/functions/submit-complaint/index.ts", (s) => s.includes("sendResendEmail(") && s.includes("sendTrackedCommunication("), "customer + admin complaint emails"],
  ["supabase/functions/journey-submit-order/index.ts", (s) => s.includes("sendResendEmail("), "order receipt/onboarding email"],
  ["supabase/functions/sim-create-order/index.ts", (s) => s.includes('type: "order_confirmation"') && s.includes("logToCommunications: true"), "SIM order confirmation email"],
  ["supabase/functions/process-cancellation-outbox/index.ts", (s) => s.includes('type: "custom_admin"') && s.includes("logToCommunications: true"), "cancellation outbox email contract"],
];

for (const [rel, predicate, description] of critical) {
  if (!fs.existsSync(path.join(root, rel))) {
    failures.push(`${rel}: missing critical email ingress (${description})`);
    continue;
  }
  const source = read(rel);
  if (!predicate(source)) failures.push(`${rel}: missing ${description}`);
}

if (failures.length) {
  console.error("Email contract audit failed:\n" + failures.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}

console.log(`Email contract audit passed: ${invokeCount} send-email invocations checked and ${critical.length} critical lifecycle paths verified.`);
