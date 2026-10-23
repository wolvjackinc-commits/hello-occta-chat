/**
 * Bakes committed browser-rendered snapshots (seo-snapshots/*.json) into the
 * production build.
 *
 * Why: Lovable publishes with `npm run build` in a sandbox without Chrome, so
 * scripts/prerender-public.mjs cannot run there and every public page would
 * ship as an empty app shell. The "SEO Snapshots" GitHub workflow renders all
 * public sitemap URLs with real Chrome and commits the SEO head tags plus the
 * rendered #root markup. This plugin merges each snapshot into the CURRENT
 * build's index.html (so script/CSS asset hashes are always current) and
 * writes dist/<route>/index.html.
 *
 * - Crawlers (Google, Bing, AI search) get the full page text, H1, canonical,
 *   Open Graph and JSON-LD without running JavaScript.
 * - Visitors see content on first paint; React then mounts with createRoot
 *   and replaces the static markup.
 * - dist/index.html is also the SPA fallback, so the static markup carries
 *   the path it belongs to and an inline guard clears it on any other path.
 *
 * Set SEO_SNAPSHOTS=off to skip (the snapshot workflow does this so it always
 * captures fresh React output rather than a previous snapshot).
 */
import type { Plugin } from "vite";
import fs from "fs";
import path from "path";

interface Snapshot {
  path: string;
  head: string[];
  root: string;
}

const SNAPSHOT_DIR = "seo-snapshots";

function tagKey(tag: string): string {
  if (tag.startsWith("<title")) return "title";
  if (tag.startsWith("<script")) return "ld+json";
  return `${tag.slice(1, 5)}:${(tag.match(/(?:name|property|rel)="([^"]+)"/) || [tag, tag])[1]}`;
}

const HEAD_TAG = new RegExp(
  [
    String.raw`\s*<title>[\s\S]*?<\/title>`,
    String.raw`\s*<meta\s+name="(?:description|keywords|robots|title|twitter:[^"]+)"[^>]*>`,
    String.raw`\s*<link\s+rel="canonical"[^>]*>`,
    String.raw`\s*<meta\s+property="(?:og:[^"]+|product:[^"]+|article:[^"]+)"[^>]*>`,
    String.raw`\s*<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>`,
  ].join("|"),
  "gi",
);

/** Removes template head tags the snapshot replaces; shell-only tags (og:image etc.) stay. */
function cleanTemplate(html: string, snapshotKeys: Set<string>): string {
  const [head, ...rest] = html.split("</head>");
  const cleanedHead = head.replace(HEAD_TAG, (match) => {
    const key = tagKey(match.trim());
    const alwaysReplace = key === "ld+json" || key === "link:canonical";
    return alwaysReplace || snapshotKeys.has(key) ? "" : match;
  });
  return [cleanedHead, ...rest].join("</head>");
}

function guardScript(routePath: string): string {
  // Runs during parsing, before first paint: if Lovable served this file for a
  // different URL (SPA fallback), drop the static markup so no wrong page flashes.
  const expected = JSON.stringify(routePath.toLowerCase());
  return (
    `<script data-seo-guard>(function(){try{var p=decodeURIComponent(location.pathname).replace(/\\/+$/,"")||"/";` +
    `if(p.toLowerCase()!==${expected}){var r=document.getElementById("root");if(r)r.innerHTML="";}}catch(e){}})();</script>`
  );
}

export function renderSnapshot(template: string, snapshot: Snapshot): string {
  const base = cleanTemplate(template, new Set(snapshot.head.map(tagKey)));
  const head = snapshot.head.map((tag) => `    ${tag}`).join("\n");
  const withHead = base.replace("</head>", () => `${head}\n  </head>`);
  const root =
    `<div id="root" data-prerendered-path="${snapshot.path.replace(/"/g, "&quot;")}">` +
    `${snapshot.root}<!--/seo-snapshot--></div>${guardScript(snapshot.path)}`;
  if (!withHead.includes('<div id="root"></div>')) {
    throw new Error("SEO snapshots: template has no empty #root");
  }
  return withHead.replace('<div id="root"></div>', () => root);
}

function readSnapshots(dir: string): Snapshot[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf-8")) as Snapshot)
    .filter((snap) => snap && typeof snap.path === "string" && snap.root?.includes("<h1"));
}

export function seoSnapshots(): Plugin {
  return {
    name: "vite-plugin-seo-snapshots",
    apply: "build",
    closeBundle: {
      sequential: true,
      order: "post",
      async handler() {
        if (process.env.SEO_SNAPSHOTS === "off") {
          console.log("SEO snapshots: skipped (SEO_SNAPSHOTS=off)");
          return;
        }
        const distDir = path.resolve(process.cwd(), "dist");
        const templatePath = path.join(distDir, "index.html");
        if (!fs.existsSync(templatePath)) return;

        const snapshots = readSnapshots(path.resolve(process.cwd(), SNAPSHOT_DIR));
        if (!snapshots.length) {
          console.warn("SEO snapshots: none committed yet, keeping head-only prerender.");
          return;
        }

        const template = fs.readFileSync(templatePath, "utf-8");
        let written = 0;
        for (const snapshot of snapshots) {
          const file =
            snapshot.path === "/"
              ? templatePath
              : path.join(distDir, snapshot.path.slice(1), "index.html");
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, renderSnapshot(template, snapshot), "utf-8");
          written++;
        }
        console.log(`✅ SEO snapshots: baked ${written} crawlable pages into dist.`);
      },
    },
  };
}
