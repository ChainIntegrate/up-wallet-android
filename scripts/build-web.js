#!/usr/bin/env node
// Builds www/, the web content of the app, from the Cross_Chain repository at the commit pinned in
// UPSTREAM.json. The app runs the same UP Wallet page as the site; only these differences are added:
//   - ethers is bundled (from the npm package, checked against the page's own SRI hash) instead of the CDN;
//   - config.js is generated from app-config.json;
//   - app/app-shim.js and app/app.css are loaded by the page (links and relay calls to the site, phone layout);
//   - app/phone-key.js, bundled with esbuild, gives the page the phone key as its signing wallet (0.9.0);
//   - app/native.js, bundled too: paste button, wc: links received from other apps, remembered UP and network;
//   - the WalletConnect metadata names the site instead of the app's origin (https://upwallet.chainintegrate.it);
//   - the page's Content-Security-Policy hashes are computed again for the changed inline script (ethers is local).
//
//   node scripts/build-web.js                    clones Cross_Chain at the pinned commit into upstream/
//   CROSS_CHAIN_DIR=/path node scripts/build-web.js   uses a local checkout instead (it must be at that commit)
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "www");
const upstream = JSON.parse(fs.readFileSync(path.join(ROOT, "UPSTREAM.json"), "utf8"));
const appConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "app-config.json"), "utf8"));

// The page and the files it loads from the site. Anything else it links to opens in the phone's browser.
const PAGE = "up-wallet.html";
const FILES = [PAGE, "theme.js", "chains.js", "asset-list.js", "usd-price.js", "token-image.js", "backup-check.js",
  "gas-relay-client.js", "call-decode.js", "abi-decode.js",
  "vendor/walletkit-1.6.0.min.js", "vendor/qrcode-generator-1.4.4.js", "banner.png", "logo.png", "favicon.ico"];
// Whole folders of the site the page uses (the networks' logos).
const DIRS = ["chain-logos"];
const ETHERS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.4/ethers.umd.min.js";
const ETHERS_LOCAL = "vendor/ethers-6.13.4.umd.min.js";

const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

function source() {
  if (process.env.CROSS_CHAIN_DIR) {
    const dir = path.resolve(process.env.CROSS_CHAIN_DIR);
    const head = git(["rev-parse", "HEAD"], dir);
    if (head !== upstream.commit) throw new Error(`${dir} is at ${head}, UPSTREAM.json pins ${upstream.commit}`);
    return dir;
  }
  const dir = path.join(ROOT, "upstream");
  if (!fs.existsSync(path.join(dir, ".git"))) {
    fs.mkdirSync(dir, { recursive: true });
    git(["init", "-q"], dir);
    git(["remote", "add", "origin", upstream.repo], dir);
  }
  git(["fetch", "-q", "--depth", "1", "origin", upstream.commit], dir);
  git(["checkout", "-q", "--detach", upstream.commit], dir);
  return dir;
}

async function main() {
  const src = source();
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const f of FILES) {
    const to = path.join(OUT, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(src, f), to);
  }
  for (const d of DIRS) {
    fs.mkdirSync(path.join(OUT, d), { recursive: true });
    for (const f of fs.readdirSync(path.join(src, d))) if (/\.png$/.test(f)) fs.copyFileSync(path.join(src, d, f), path.join(OUT, d, f));
  }

  let html = fs.readFileSync(path.join(OUT, PAGE), "utf8");
  // Every local script the page loads must be in FILES (config.js is generated): a script added to the
  // page upstream and missing here would leave the app without it.
  const missing = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])
    .filter((src) => !/^https?:/.test(src) && src !== "config.js" && !FILES.includes(src));
  if (missing.length) throw new Error(`the page loads ${missing.join(", ")}: add to FILES in scripts/build-web.js`);
  const site = new URL(appConfig.site).href;

  // ethers: the same file the CDN serves, verified against the integrity attribute of the page itself.
  const tag = html.match(/<script src="([^"]+)" integrity="(sha384-[^"]+)"[^>]*><\/script>/);
  if (!tag || tag[1] !== ETHERS_CDN) throw new Error("ethers script tag not found in the page, or a different version");
  const ethers = fs.readFileSync(path.join(ROOT, "node_modules", "ethers", "dist", "ethers.umd.min.js"));
  const sri = "sha384-" + crypto.createHash("sha384").update(ethers).digest("base64");
  if (sri !== tag[2]) throw new Error(`ethers from npm (${sri}) does not match the page's SRI (${tag[2]})`);
  fs.mkdirSync(path.join(OUT, "vendor"), { recursive: true });
  fs.writeFileSync(path.join(OUT, ETHERS_LOCAL), ethers);
  html = html.replace(tag[0], `<script src="${ETHERS_LOCAL}" integrity="${sri}"></script>`);

  // The app's additions, right after theme.js: before any other script of the page runs.
  const anchor = '<script src="theme.js"></script>';
  if (!html.includes(anchor)) throw new Error("theme.js script tag not found in the page");
  html = html.replace(anchor, `${anchor}\n<script src="app/app-shim.js"></script>\n<script src="app/diag.js"></script>\n<link rel="stylesheet" href="app/app.css">`);
  // The phone key, after config.js (the last script of the head): chains.js and ethers are loaded by then.
  const cfg = '<script src="config.js"></script>';
  if (!html.includes(cfg)) throw new Error("config.js script tag not found in the page");
  html = html.replace(cfg, `${cfg}\n<script src="app/phone-key.js"></script>\n<script src="app/native.js"></script>`);
  // The version line at the bottom of the page: the app names the page's Cross_Chain commit.
  const COMMIT_LINE = "const PAGE_COMMIT = null;";
  if (!html.includes(COMMIT_LINE)) throw new Error("PAGE_COMMIT not found in the page");
  html = html.replace(COMMIT_LINE, `const PAGE_COMMIT = ${JSON.stringify(upstream.commit.slice(0, 7))};`);

  // WalletConnect metadata: the page names its own origin, which in the app is https://upwallet.chainintegrate.it.
  // dApps are shown the site instead (its address and icon).
  const META = "      url: location.origin,\n      icons: [location.origin + \"/favicon.ico\"],";
  if (!html.includes(META)) throw new Error("WalletConnect metadata (url, icons) not found in the page");
  // redirect.native: UP Wallet's own link, which dApps open to bring the app forward with a request.
  html = html.replace(META, `      url: ${JSON.stringify(site.replace(/\/$/, ""))},\n      icons: [${JSON.stringify(site + "favicon.ico")}],\n      redirect: { native: "upwallet://" },`);
  // Content-Security-Policy: the page lists the SHA-256 hash of each inline script it runs (Cross_Chain's
  // tools/csp.js). The metadata change above edits one of them, so the hashes are computed again here,
  // on the final page. The app's own scripts are files ('self'); Capacitor's bridge is injected at
  // document start by the WebView, outside the page's policy.
  const CSP = /<meta http-equiv="Content-Security-Policy" content="script-src ([^"]*)">/;
  const csp = html.match(CSP);
  if (csp) {
    const inline = [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter((m) => !/\ssrc=/.test(m[1] || "")).map((m) => m[2]);
    const keep = csp[1].split(" ").filter((x) => !x.startsWith("'sha256-") && x !== "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.4/");
    const hashes = inline.map((x) => `'sha256-${crypto.createHash("sha256").update(x, "utf8").digest("base64")}'`);
    html = html.replace(CSP, `<meta http-equiv="Content-Security-Policy" content="script-src ${[...keep, ...hashes].join(" ")}">`);
  }
  fs.writeFileSync(path.join(OUT, PAGE), html);

  fs.mkdirSync(path.join(OUT, "app"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "app", "app-shim.js"),
    fs.readFileSync(path.join(ROOT, "app", "app-shim.js"), "utf8").replace("__SITE__", site).replace("__PAGE__", PAGE));
  fs.copyFileSync(path.join(ROOT, "app", "app.css"), path.join(OUT, "app", "app.css"));
  fs.copyFileSync(path.join(ROOT, "app", "diag.js"), path.join(OUT, "app", "diag.js"));
  for (const name of ["phone-key.js", "native.js"]) await require("esbuild").build({
    entryPoints: [path.join(ROOT, "app", name)], outfile: path.join(OUT, "app", name),
    bundle: true, format: "iife", platform: "browser", target: "es2020", minify: true, legalComments: "none", logLevel: "warning",
    define: { "process.env.NODE_ENV": '"production"', global: "globalThis" },
  });
  // The Alchemy key (token lists in the send panel) is the site's, from the environment (a CI secret):
  // never in the repository. Like on the site, it is protected by Alchemy's allowed-origins list, not by
  // being secret: the app's origin, upwallet.chainintegrate.it, must be on it. Without it: Blockscout only.
  const alchemyApiKey = /^[A-Za-z0-9_-]{8,128}$/.test(process.env.ALCHEMY_KEY || "") ? process.env.ALCHEMY_KEY : "";
  fs.writeFileSync(path.join(OUT, "config.js"),
    `// Generated by scripts/build-web.js from app-config.json.\nwindow.CROSSCHAIN_CONFIG = ${JSON.stringify({ walletConnectProjectId: appConfig.walletConnectProjectId || "", alchemyApiKey }, null, 2)};\n`);
  if (!alchemyApiKey) console.log("No ALCHEMY_KEY in the environment: token lists from Blockscout only.");
  fs.writeFileSync(path.join(OUT, "index.html"),
    `<!DOCTYPE html>\n<html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=${PAGE}"></head><body></body></html>\n`);
  console.log(`www/ built from Cross_Chain ${upstream.commit.slice(0, 7)}: ${FILES.length + 7} files.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
