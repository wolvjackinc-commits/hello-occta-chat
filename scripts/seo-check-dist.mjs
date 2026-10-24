/**
 * Checks built HTML for every public sitemap URL.
 * Fails when a page is missing, shares a title, or lacks description, canonical, H1 or valid JSON-LD.
 */
import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve("dist");
const SITE = "https://www.occta.co.uk";
const KB_SITEMAP = "https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/kb-sitemap";

function locsFromXml(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map((match) => match[1].trim());
}

/** Retired pages that public/_redirects 301s away; never render or check them. */
const RETIRED_PATHS = new Set([
  "/help/how-to-pay-by-invoice-link",
  "/guides/invoice-link-payment-guide",
  "/help/what-to-do-if-your-card-payment-fails",
]);

/** Product-category landing pages that must expose Offer schema. */
const PRODUCT_PATHS = new Set([
  "/full-fibre-broadband", "/gigabit-broadband", "/ultrafast-broadband", "/superfast-broadband",
  "/broadband-without-landline", "/moving-house-broadband", "/fixed-price-broadband",
  "/unlimited-data-sim", "/30-day-sim-only", "/esim", "/data-only-sim",
  "/o2-sim-only-deals", "/vodafone-sim-only-deals", "/ee-sim-only-deals",
  "/business/sip-trunks", "/business/voice",
]);

/** City pages (/broadband-<slug>) read from src/data/locations.ts. */
const CITY_PATHS = new Set(
  [...fs.readFileSync(path.resolve("src/data/locations.ts"), "utf8").matchAll(/slug: "([a-z-]+)"/g)].map((m) => `/broadband-${m[1]}`),
);

function pathnameOf(loc) {
  const url = new URL(loc);
  let pathname = url.pathname || "/";
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  return pathname;
}

function htmlFile(pathname) {
  if (pathname === "/") return path.join(DIST, "index.html");
  return path.join(DIST, pathname.slice(1), "index.html");
}

function stripScripts(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
}

function textOf(html) {
  return stripScripts(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function pathsToCheck() {
  const locs = [];
  for (const name of ["sitemap.xml", "sitemap-learning.xml"]) {
    const file = path.join(DIST, name);
    if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
    locs.push(...locsFromXml(fs.readFileSync(file, "utf8")));
  }
  const response = await fetch(KB_SITEMAP);
  if (!response.ok) throw new Error(`kb sitemap ${response.status}`);
  locs.push(...locsFromXml(await response.text()));

  const paths = [];
  const seen = new Set();
  for (const loc of locs) {
    const url = new URL(loc);
    if (url.hostname !== "www.occta.co.uk") throw new Error(`non-canonical sitemap loc ${loc}`);
    const pathname = pathnameOf(loc);
    if (RETIRED_PATHS.has(pathname)) continue;
    if (seen.has(pathname)) throw new Error(`duplicate sitemap path ${pathname}`);
    seen.add(pathname);
    paths.push(pathname);
  }
  return paths;
}

// --snapshots: check a plain `vite build` whose pages come from committed
// seo-snapshots/ (vite-plugin-seo-snapshots.ts) instead of a live prerender.
const SNAPSHOT_MODE = process.argv.includes("--snapshots");
const manifestPath = path.join(DIST, "prerender-manifest.json");
if (!SNAPSHOT_MODE && fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.skipped) {
    console.warn(`SEO check skipped: ${manifest.reason || "browser prerender did not run"}`);
    process.exit(0);
  }
}

const paths = await pathsToCheck();
const errors = [];
const titles = new Map();

for (const pathname of paths) {
  const file = htmlFile(pathname);
  if (!fs.existsSync(file)) {
    errors.push(`${pathname}: no prerendered HTML at ${path.relative(DIST, file)}`);
    continue;
  }
  const html = fs.readFileSync(file, "utf8");
  const titlesInPage = [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)].map((match) => match[1].replace(/\s+/g, " ").trim());
  const descriptions = [...html.matchAll(/<meta\s+name="description"\s+content="([^"]*)"/gi)].map((match) => match[1].trim());
  const canonicals = [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"/gi)].map((match) => match[1]);
  const h1s = [...stripScripts(html).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const ld = [...html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  const expected = `${SITE}${pathname === "/" ? "/" : pathname}`;

  if (titlesInPage.length !== 1 || !titlesInPage[0]) errors.push(`${pathname}: expected one title, found ${titlesInPage.length}`);
  if (descriptions.length !== 1 || !descriptions[0]) errors.push(`${pathname}: expected one meta description`);
  if (canonicals.length !== 1 || canonicals[0] !== expected) errors.push(`${pathname}: canonical ${canonicals.join(" | ") || "missing"} should be ${expected}`);
  if (!html.includes(`property="og:url" content="${expected}"`) && !html.includes(`property="og:url" content='${expected}'`)) {
    errors.push(`${pathname}: missing self og:url`);
  }
  if (h1s.length !== 1 || !h1s[0][1].replace(/<[^>]+>/g, "").trim()) errors.push(`${pathname}: expected one H1, found ${h1s.length}`);
  if (ld.length === 0) errors.push(`${pathname}: missing JSON-LD`);
  for (const block of ld) {
    try {
      JSON.parse(block[1]);
    } catch (error) {
      errors.push(`${pathname}: invalid JSON-LD (${error instanceof Error ? error.message : error})`);
    }
  }
  // Page-type schema guards: product pages must carry offers, articles must
  // carry Article schema (a snapshot change once silently dropped both).
  const ldText = ld.map((block) => block[1]).join(" ");
  const isArticle = /^\/(learn|guides|blog|help)\/[^/]+$/.test(pathname);
  const isProduct = pathname === "/" || pathname === "/broadband" || CITY_PATHS.has(pathname) || PRODUCT_PATHS.has(pathname);
  if (isArticle && !/"@type":"(Article|TechArticle|BlogPosting|HowTo)"/.test(ldText)) errors.push(`${pathname}: article page missing Article schema`);
  if (isProduct && !/"@type":"(Offer|AggregateOffer)"/.test(ldText)) errors.push(`${pathname}: product page missing Offer schema`);
  if (!/"@type":"BreadcrumbList"/.test(ldText) && (isArticle || (isProduct && pathname !== "/"))) errors.push(`${pathname}: missing BreadcrumbList schema`);

  const body = textOf(html);
  if (/Loading[^.…]{0,30}(…|\.\.\.)/.test(body)) errors.push(`${pathname}: prerender still contains Loading`);
  if (body.length < 40) errors.push(`${pathname}: body text is too short`);
  if ((html.match(/&amp;amp;/g) || []).length) errors.push(`${pathname}: double-encoded &amp;amp;`);

  const title = titlesInPage[0];
  if (title) {
    if (titles.has(title)) errors.push(`${pathname}: title duplicates ${titles.get(title)} (${title})`);
    else titles.set(title, pathname);
  }
}

const notFound = path.join(DIST, "404.html");
if (SNAPSHOT_MODE) {
  // Lovable serves its own SPA fallback; 404.html only exists after a live prerender.
} else if (!fs.existsSync(notFound)) errors.push("missing dist/404.html");
else {
  const html = fs.readFileSync(notFound, "utf8");
  if (!/noindex/i.test(html)) errors.push("404.html is missing noindex");
  if (!/<h1\b[^>]*>[\s\S]*404/i.test(html)) errors.push("404.html is missing the 404 heading");
}

if (errors.length) {
  console.error(errors.slice(0, 40).join("\n"));
  if (errors.length > 40) console.error(`…and ${errors.length - 40} more`);
  console.error(`SEO check failed: ${errors.length} problems across ${paths.length} sitemap URLs`);
  process.exit(1);
}

console.log(`SEO check passed for ${paths.length} sitemap URLs`);
