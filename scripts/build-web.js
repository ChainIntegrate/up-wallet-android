#!/usr/bin/env node
// Builds www/, the web content of the app, from the Cross_Chain repository at the commit pinned in
// UPSTREAM.json. The app runs the same UP Wallet page as the site; only these differences are added:
//   - ethers is bundled (from the npm package, checked against the page's own SRI hash) instead of the CDN;
//   - config.js is generated from app-config.json;
//   - app/app-shim.js and app/app.css are loaded by the page (links and relay calls to the site, phone layout);
//   - app/metamask.js, bundled with esbuild, gives the page MetaMask mobile as its signing wallet.
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
const FILES = [PAGE, "theme.js", "chains.js", "backup-check.js", "gas-relay-client.js",
  "vendor/walletkit-1.6.0.min.js", "banner.png", "logo.png", "favicon.ico"];
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

function main() {
  const src = source();
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const f of FILES) {
    const to = path.join(OUT, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(src, f), to);
  }

  let html = fs.readFileSync(path.join(OUT, PAGE), "utf8");

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
  html = html.replace(anchor, `${anchor}\n<script src="app/app-shim.js"></script>\n<link rel="stylesheet" href="app/app.css">`);
  // MetaMask, after config.js (the last script of the head): chains.js is loaded by then.
  const cfg = '<script src="config.js"></script>';
  if (!html.includes(cfg)) throw new Error("config.js script tag not found in the page");
  html = html.replace(cfg, `${cfg}\n<script src="app/metamask.js"></script>`);
  fs.writeFileSync(path.join(OUT, PAGE), html);

  fs.mkdirSync(path.join(OUT, "app"), { recursive: true });
  const site = new URL(appConfig.site).href;
  fs.writeFileSync(path.join(OUT, "app", "app-shim.js"),
    fs.readFileSync(path.join(ROOT, "app", "app-shim.js"), "utf8").replace("__SITE__", site).replace("__PAGE__", PAGE));
  fs.copyFileSync(path.join(ROOT, "app", "app.css"), path.join(OUT, "app", "app.css"));
  require("esbuild").buildSync({
    entryPoints: [path.join(ROOT, "app", "metamask.js")], outfile: path.join(OUT, "app", "metamask.js"),
    bundle: true, format: "iife", platform: "browser", target: "es2020", minify: true, legalComments: "none", logLevel: "warning",
    define: { "process.env.NODE_ENV": '"production"', global: "globalThis" },
  });
  fs.writeFileSync(path.join(OUT, "config.js"),
    `// Generated by scripts/build-web.js from app-config.json.\nwindow.CROSSCHAIN_CONFIG = ${JSON.stringify({ walletConnectProjectId: appConfig.walletConnectProjectId || "" }, null, 2)};\n`);
  fs.writeFileSync(path.join(OUT, "index.html"),
    `<!DOCTYPE html>\n<html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=${PAGE}"></head><body></body></html>\n`);
  console.log(`www/ built from Cross_Chain ${upstream.commit.slice(0, 7)}: ${FILES.length + 5} files.`);
}

main();
