/**
 * Renders every public sitemap URL to dist/<route>/index.html after `vite build`.
 * Uses the real browser so Supabase-backed articles are fetched before the HTML is saved.
 *
 * Lovable publishes with `npm run build` in a Node sandbox that does not include
 * Chrome. Browser download is disabled so dependency install cannot fail there.
 * When no browser can be launched this script keeps the Vite SPA output and exits
 * 0. CI sets PRERENDER_REQUIRE_BROWSER=1 so a missing browser fails that job.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve("dist");
const HOST = "127.0.0.1";
const PORT = 4179;
const ORIGIN = `http://${HOST}:${PORT}`;
const SITE = "https://www.occta.co.uk";
const KB_SITEMAP = "https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/kb-sitemap";
/** Pages that stay reachable but point their canonical at the primary URL. */
const CANONICAL_OVERRIDES = {
  "/guides/how-to-switch-broadband-uk": "/guides/how-to-switch-broadband",
};

function contentType(file) {
  const ext = path.extname(file);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".xml": "application/xml",
    ".txt": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".webmanifest": "application/manifest+json",
    ".woff2": "font/woff2",
  };
  return types[ext] || "application/octet-stream";
}

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const relative = clean === "/" ? "/index.html" : clean;
  const direct = path.join(DIST, relative);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  const nested = path.join(DIST, relative, "index.html");
  if (fs.existsSync(nested)) return nested;
  return path.join(DIST, "index.html");
}

function startServer() {
  const server = http.createServer((req, res) => {
    const file = resolveFile(req.url || "/");
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      res.end("missing");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(file), "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, HOST, () => resolve(server)));
}

function locsFromXml(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map((match) => match[1].trim());
}

function pathnameOf(loc) {
  const url = new URL(loc);
  let pathname = url.pathname || "/";
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  return pathname;
}

function shouldPrerender(pathname) {
  if (!pathname.startsWith("/")) return false;
  const blockedExact = new Set([
    "/track-order",
    "/status",
    "/privacy-policy",
    "/checkout",
    "/pre-checkout",
    "/dashboard",
    "/auth",
    "/quote/thank-you",
    "/business-legacy",
    "/install",
    "/offline",
  ]);
  if (blockedExact.has(pathname)) return false;
  if (pathname.startsWith("/admin") || pathname.startsWith("/dashboard/")) return false;
  if (pathname === "/pay" || pathname.startsWith("/pay/")) return false;
  if (pathname === "/pay-invoice" || pathname === "/payment-result") return false;
  if (pathname.startsWith("/receipt/")) return false;
  if (pathname.startsWith("/order/") || pathname.startsWith("/sim/checkout") || pathname.startsWith("/sim/order-success")) return false;
  if (pathname.startsWith("/quote/") && pathname !== "/quote/start") return false;
  return true;
}

async function collectPaths() {
  const files = ["sitemap.xml", "sitemap-learning.xml"].map((name) => path.join(DIST, name));
  const locs = [];
  for (const file of files) {
    if (fs.existsSync(file)) locs.push(...locsFromXml(fs.readFileSync(file, "utf8")));
  }
  const response = await fetch(KB_SITEMAP);
  if (!response.ok) throw new Error(`kb sitemap ${response.status}`);
  locs.push(...locsFromXml(await response.text()));

  const paths = [];
  const seen = new Set();
  for (const loc of locs) {
    const url = new URL(loc);
    if (url.hostname !== "www.occta.co.uk") continue;
    const pathname = pathnameOf(loc);
    if (!shouldPrerender(pathname) || seen.has(pathname)) continue;
    seen.add(pathname);
    paths.push(pathname);
  }
  if (!paths.includes("/")) paths.unshift("/");
  for (const extra of Object.keys(CANONICAL_OVERRIDES)) {
    if (!seen.has(extra)) paths.push(extra);
  }
  return paths;
}

function outputFile(pathname) {
  if (pathname === "/") return path.join(DIST, "index.html");
  return path.join(DIST, pathname.slice(1), "index.html");
}

function keepLast(html, pattern) {
  const matches = [...html.matchAll(pattern)];
  if (matches.length <= 1) return html;
  let out = html;
  for (const match of matches.slice(0, -1)) out = out.replace(match[0], "");
  return out;
}

function postProcess(html, pathname) {
  const canonicalPath = CANONICAL_OVERRIDES[pathname] || pathname;
  const canonical = `${SITE}${canonicalPath === "/" ? "/" : canonicalPath}`;
  let out = html.replaceAll(ORIGIN, SITE);
  out = out.replace(/&amp;amp;/g, "&amp;");
  out = keepLast(out, /<title>[\s\S]*?<\/title>/g);
  out = keepLast(out, /<meta\s+name="description"[^>]*>/g);
  out = keepLast(out, /<link\s+rel="canonical"[^>]*>/g);
  out = keepLast(out, /<meta\s+property="og:url"[^>]*>/g);
  out = keepLast(out, /<meta\s+name="twitter:title"[^>]*>/g);
  if (!/<link\s+rel="canonical"/i.test(out)) {
    out = out.replace("</head>", `    <link rel="canonical" href="${canonical}" />\n  </head>`);
  } else {
    out = out.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${canonical}" />`);
  }
  if (!/property="og:url"/i.test(out)) {
    out = out.replace("</head>", `    <meta property="og:url" content="${canonical}" />\n  </head>`);
  } else {
    out = out.replace(/<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${canonical}" />`);
  }
  return out;
}

async function renderPath(browser, pathname) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error instanceof Error ? error.message : String(error)));
  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      if (/fonts\.(googleapis|gstatic)|google-analytics|googletagmanager|doubleclick|facebook\.net|hotjar/i.test(url)) {
        request.abort();
        return;
      }
      request.continue();
    });
    await page.evaluateOnNewDocument(() => {
      const markShellMeta = () => {
        document.querySelectorAll('meta[name="description"]').forEach((node) => {
          if (!node.getAttribute("data-shell-meta")) node.setAttribute("data-shell-meta", "1");
        });
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", markShellMeta, { once: true });
      } else {
        markShellMeta();
      }
    });
    await page.goto(`${ORIGIN}${pathname}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForFunction(() => {
      const root = document.querySelector("#root");
      const text = root?.innerText || "";
      if (!document.querySelector("h1")) return false;
      if (text.includes("Loading…") || text.includes("Loading...")) return false;
      if (text.trim().length <= 20) return false;
      // Helmet appends a description after the shell tags marked above.
      return [...document.querySelectorAll('meta[name="description"]')].some((node) => !node.getAttribute("data-shell-meta"));
    }, { timeout: 45000 });
    const h1 = await page.$eval("h1", (el) => (el.textContent || "").trim());
    if (h1 === "404") throw new Error(`rendered the 404 page for ${pathname}`);
    if (pageErrors.length) throw new Error(pageErrors[0]);
    const html = postProcess(await page.content(), pathname);
    if (!html.includes("<h1") || html.includes("Loading…")) {
      throw new Error(`incomplete HTML for ${pathname}`);
    }
    const file = outputFile(pathname);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    console.log(`ok ${pathname}`);
    return pathname;
  } finally {
    await page.close();
  }
}

async function render404(browser) {
  const page = await browser.newPage();
  try {
    await page.goto(`${ORIGIN}/this-page-does-not-exist-seo`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForFunction(() => document.querySelector("h1")?.textContent?.includes("404"), { timeout: 20000 });
    let html = postProcess(await page.content(), "/this-page-does-not-exist-seo");
    html = html.replace(/<link\s+rel="canonical"[^>]*>/gi, "");
    html = html.replace(/<meta\s+name="robots"[^>]*>/gi, "");
    html = html.replace("</head>", `    <meta name="robots" content="noindex, nofollow" />\n  </head>`);
    fs.writeFileSync(path.join(DIST, "404.html"), html);
  } finally {
    await page.close();
  }
}

async function pool(items, limit, worker) {
  const queue = [...items];
  const failures = [];
  async function run() {
    while (queue.length) {
      const pathname = queue.shift();
      try {
        await worker(pathname);
      } catch (error) {
        failures.push(`${pathname}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  return failures;
}

const BROWSER_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/local/bin/google-chrome",
].filter((candidate) => typeof candidate === "string" && candidate.length > 0);

function writeManifest(manifest) {
  fs.writeFileSync(path.join(DIST, "prerender-manifest.json"), JSON.stringify(manifest, null, 2));
}

async function launchBrowser() {
  let puppeteer;
  try {
    puppeteer = (await import("puppeteer")).default;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reason = `puppeteer could not be loaded (${message.split("\n")[0]})`;
    const skipped = new Error(reason);
    skipped.code = "PRERENDER_SKIPPED";
    throw skipped;
  }

  const attempts = [null, ...BROWSER_CANDIDATES.filter((candidate) => fs.existsSync(candidate))];
  const tried = new Set();
  let lastError = "no Chrome or Chromium executable was found";
  for (const executablePath of attempts) {
    if (executablePath && tried.has(executablePath)) continue;
    if (executablePath) tried.add(executablePath);
    try {
      return await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        ...(executablePath ? { executablePath } : {}),
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message.split("\n")[0] : String(error);
    }
  }
  const skipped = new Error(`Chromium could not be launched (${lastError})`);
  skipped.code = "PRERENDER_SKIPPED";
  throw skipped;
}

const server = await startServer();
try {
  let browser;
  try {
    browser = await launchBrowser();
  } catch (error) {
    if (error && error.code === "PRERENDER_SKIPPED") {
      const reason = error instanceof Error ? error.message : String(error);
      if (process.env.PRERENDER_REQUIRE_BROWSER === "1") {
        console.error(`SEO prerender required but unavailable: ${reason}`);
        process.exitCode = 1;
      } else {
        console.warn(`SEO prerender skipped: ${reason}`);
        console.warn("Shipping the Vite SPA without browser-rendered HTML. The build will still succeed.");
        writeManifest({ skipped: true, count: 0, reason, paths: [] });
      }
      browser = null;
    } else {
      throw error;
    }
  }

  if (browser) {
    try {
      const paths = await collectPaths();
      console.log(`Prerendering ${paths.length} public routes`);
      const failures = await pool(paths, 2, (pathname) => renderPath(browser, pathname));
      await render404(browser);
      writeManifest({ skipped: false, count: paths.length - failures.length, paths });
      if (failures.length) {
        console.error(failures.join("\n"));
        throw new Error(`${failures.length} routes failed to prerender`);
      }
      console.log(`Prerendered ${paths.length} routes plus 404.html`);
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
