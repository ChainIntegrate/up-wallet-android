#!/usr/bin/env node
// Builds www/, the web content of the app, from the Cross_Chain repository at the commit pinned in
// UPSTREAM.json. The app runs the same UP Wallet page as the site; only these differences are added:
//   - ethers is bundled (from the npm package, checked against the page's own SRI hash) instead of the CDN;
//   - config.js is generated from app-config.json;
//   - app/app-shim.js and app/app.css are loaded by the page (links and relay calls to the site, phone layout);
//   - app/metamask.js, bundled with esbuild, gives the page MetaMask mobile as its signing wallet;
//   - app/native.js, bundled too: paste button, wc: links received from other apps, remembered UP and network;
//   - the WalletConnect metadata names the site instead of the app's origin (https://upwallet.chainintegrate.it).
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

async function main() {
  const src = source();
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const f of FILES) {
    const to = path.join(OUT, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(src, f), to);
  }

  let html = fs.readFileSync(path.join(OUT, PAGE), "utf8");
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
  // MetaMask, after config.js (the last script of the head): chains.js is loaded by then.
  const cfg = '<script src="config.js"></script>';
  if (!html.includes(cfg)) throw new Error("config.js script tag not found in the page");
  html = html.replace(cfg, `${cfg}\n<script src="app/metamask.js"></script>\n<script src="app/native.js"></script>`);
  // WalletConnect metadata: the page names its own origin, which in the app is https://upwallet.chainintegrate.it.
  // dApps are shown the site instead (its address and icon).
  const META = "      url: location.origin,\n      icons: [location.origin + \"/favicon.ico\"],";
  if (!html.includes(META)) throw new Error("WalletConnect metadata (url, icons) not found in the page");
  // redirect.native: UP Wallet's own link, which dApps open to bring the app forward with a request.
  html = html.replace(META, `      url: ${JSON.stringify(site.replace(/\/$/, ""))},\n      icons: [${JSON.stringify(site + "favicon.ico")}],\n      redirect: { native: "upwallet://" },`);
  fs.writeFileSync(path.join(OUT, PAGE), html);

  fs.mkdirSync(path.join(OUT, "app"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "app", "app-shim.js"),
    fs.readFileSync(path.join(ROOT, "app", "app-shim.js"), "utf8").replace("__SITE__", site).replace("__PAGE__", PAGE));
  fs.copyFileSync(path.join(ROOT, "app", "app.css"), path.join(OUT, "app", "app.css"));
  fs.copyFileSync(path.join(ROOT, "app", "diag.js"), path.join(OUT, "app", "diag.js"));
  // Two changes to MetaMask Connect (connect-multichain), each required to match exactly once:
  // - each request may take 5 minutes instead of 60 s: on a phone the user goes to MetaMask, reads,
  //   confirms and comes back ("Transport request timed out");
  // - when the window gets focus, the connection to MetaMask's relay is renewed even if it looks open.
  //   While UP Wallet is in the background Android suspends it and the socket goes stale; the answer
  //   MetaMask sent meanwhile was never read (the request then timed out). Renewing resubscribes and
  //   reads the channel's history, as the protocol's own docs recommend for mobile clients returning
  //   to the foreground. app/metamask.js turns "the app came back" into a focus event.
  const MM_PATCHES = [
    ["DEFAULT_REQUEST_TIMEOUT2 = 60 * 1e3;", "DEFAULT_REQUEST_TIMEOUT2 = 5 * 60 * 1e3;"],
    ["onWindowFocus() {\n        if (!this.isConnected()) {\n          this.dappClient.reconnect();\n        }\n      }",
     "onWindowFocus() {\n        this.dappClient.reconnect().catch(() => {});\n      }"],
  ];
  const mmPatch = {
    name: "metamask-connect-patches",
    setup(b) {
      b.onLoad({ filter: /connect-multichain[\\/]dist[\\/]browser[\\/]es[\\/]connect-multichain\.mjs$/ }, (args) => {
        let src = fs.readFileSync(args.path, "utf8");
        for (const [from, to] of MM_PATCHES) {
          if (src.split(from).length !== 2) throw new Error("MetaMask Connect patch does not apply (check the new version): " + from.slice(0, 60));
          src = src.replace(from, to);
        }
        return { contents: src, loader: "js" };
      });
    },
  };
  for (const name of ["metamask.js", "native.js"]) await require("esbuild").build({
    plugins: [mmPatch],
    entryPoints: [path.join(ROOT, "app", name)], outfile: path.join(OUT, "app", name),
    bundle: true, format: "iife", platform: "browser", target: "es2020", minify: true, legalComments: "none", logLevel: "warning",
    define: { "process.env.NODE_ENV": '"production"', global: "globalThis" },
  });
  fs.writeFileSync(path.join(OUT, "config.js"),
    `// Generated by scripts/build-web.js from app-config.json.\nwindow.CROSSCHAIN_CONFIG = ${JSON.stringify({ walletConnectProjectId: appConfig.walletConnectProjectId || "" }, null, 2)};\n`);
  fs.writeFileSync(path.join(OUT, "index.html"),
    `<!DOCTYPE html>\n<html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=${PAGE}"></head><body></body></html>\n`);
  console.log(`www/ built from Cross_Chain ${upstream.commit.slice(0, 7)}: ${FILES.length + 7} files.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
