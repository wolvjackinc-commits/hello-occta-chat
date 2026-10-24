/**
 * After the SEO Snapshots workflow refreshes pages:
 *  1. bumps <lastmod> in public/sitemap*.xml for pages whose snapshot changed
 *  2. submits those URLs to IndexNow (Bing, Yandex, Seznam, Naver; Bing feeds
 *     ChatGPT search and Copilot) so changes are recrawled within hours.
 *
 * Usage: node scripts/seo-indexnow.mjs <changed snapshot files…>
 * Set INDEXNOW_DRY_RUN=1 to skip the network call.
 */
import fs from "node:fs";
import path from "node:path";

const SITE = "https://www.occta.co.uk";
const HOST = "www.occta.co.uk";
const SITEMAPS = ["public/sitemap.xml", "public/sitemap-learning.xml"];

const keyFile = fs.readdirSync("public").find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) throw new Error("IndexNow key file public/<key>.txt not found");
const key = keyFile.replace(/\.txt$/, "");

const files = process.argv.slice(2).filter((f) => f.endsWith(".json") && fs.existsSync(f));
const urls = [...new Set(files.map((f) => {
  const { path: p } = JSON.parse(fs.readFileSync(f, "utf8"));
  return `${SITE}${p === "/" ? "/" : p}`;
}))];

if (!urls.length) {
  console.log("IndexNow: no changed pages");
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
const norm = (u) => u.replace(/\/$/, "");
const changed = new Set(urls.map(norm));
for (const file of SITEMAPS) {
  if (!fs.existsSync(file)) continue;
  const xml = fs.readFileSync(file, "utf8");
  const next = xml.replace(/<url>([\s\S]*?)<\/url>/g, (block, inner) => {
    const loc = (inner.match(/<loc>\s*([^<]+?)\s*<\/loc>/) || [])[1];
    if (!loc || !changed.has(norm(loc))) return block;
    if (/<lastmod>/.test(inner)) return block.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${today}</lastmod>`);
    return block.replace(/<\/loc>/, `</loc><lastmod>${today}</lastmod>`);
  });
  if (next !== xml) fs.writeFileSync(file, next);
}
console.log(`lastmod set to ${today} for ${urls.length} changed pages`);

if (process.env.INDEXNOW_DRY_RUN === "1") process.exit(0);
for (let i = 0; i < urls.length; i += 10000) {
  const body = { host: HOST, key, keyLocation: `${SITE}/${keyFile}`, urlList: urls.slice(i, i + 10000) };
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  // 200/202 accepted; 403 means the key file isn't live yet (site not republished).
  console.log(`IndexNow: ${res.status} for ${body.urlList.length} URLs`);
}
