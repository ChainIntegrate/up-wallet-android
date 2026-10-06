// app/metamask.js with the page: the page finds "MetaMask (app)" as its signing wallet, and what it asks
// reaches MetaMask Connect. MetaMask Connect itself is replaced by test/mock-connect-evm.js; a second
// part loads the real bundle and checks that it loads cleanly and announces itself. Run after `npm run web`.
"use strict";
const fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, ".."), WWW = path.join(ROOT, "www");
const TYPES = { ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".html": "text/html" };
const res = []; const ck = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"} ${n}${c ? "" : "\n      " + String(x).slice(0, 1200)}`);

const mockBundle = esbuild.buildSync({
  entryPoints: [path.join(ROOT, "app", "metamask.js")], bundle: true, format: "iife", platform: "browser", write: false,
  alias: { "@metamask/connect-evm": path.join(__dirname, "mock-connect-evm.js") }, logLevel: "error",
}).outputFiles[0].contents;

async function page(b, bundle) {
  const errs = [];
  const p = await b.newPage({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  p.on("pageerror", (e) => errs.push(e.message));
  await p.route("**/*", (r) => {
    const u = new URL(r.request().url());
    if (u.host !== "localhost") return r.abort();
    if (bundle && u.pathname === "/app/metamask.js") return r.fulfill({ body: Buffer.from(bundle), contentType: "application/javascript" });
    const f = path.join(WWW, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: "" });
    r.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || "application/octet-stream" });
  });
  await p.goto("https://localhost/up-wallet.html");
  await p.waitForFunction(() => typeof ethers !== "undefined" && document.getElementById("connectSigner"));
  return { p, errs };
}

(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

  let { p, errs } = await page(b, mockBundle);
  const seen = await p.evaluate(() => new Promise((ok) => {
    const got = [];
    window.addEventListener("eip6963:announceProvider", (e) => got.push(e.detail.info.name));
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(() => ok(got), 50);
  }));
  ck("announced through EIP-6963 as \"MetaMask (app)\", the only wallet", seen.length === 1 && seen[0] === "MetaMask (app)", JSON.stringify(seen));
  ck("nothing is started before the page asks for the wallet", await p.evaluate(() => !window.__mm));
  await p.click("#connectSigner");
  await p.waitForFunction(() => window.__mm && window.__mm.calls.includes("eth_requestAccounts"));
  await p.waitForTimeout(300);
  const mm = await p.evaluate(() => ({ calls: window.__mm.calls, created: window.__mm.created, opt: { ...window.__mm.options, mobile: { useDeeplink: window.__mm.options.mobile.useDeeplink, open: typeof window.__mm.options.mobile.preferredOpenLink } }, events: Object.keys(window.__mm.handlers) }));
  ck("Connect MetaMask: the page's request reaches MetaMask Connect (eth_requestAccounts)", mm.calls[0] === "eth_requestAccounts", JSON.stringify(mm.calls));
  ck("the page then follows account and network changes (listeners reach the client)", mm.events.includes("accountsChanged") && mm.events.includes("chainChanged"), JSON.stringify(mm.events));
  ck("one client for the whole session", mm.created === 1, mm.created);
  ck("analytics off; MetaMask opened by metamask:// links through the app", mm.opt.analytics && mm.opt.analytics.enabled === false && mm.opt.mobile.useDeeplink === true && mm.opt.mobile.open === "function", JSON.stringify(mm.opt));
  const nets = mm.opt.api.supportedNetworks;
  ck("networks from chains.js with their RPC (Base, Polygon, Arbitrum, Avalanche, Arc)",
    nets["0x2105"] === "https://base-rpc.publicnode.com" && nets["0x89"] && nets["0xa4b1"] && nets["0xa86a"] && nets["0x13b2"], JSON.stringify(nets).slice(0, 300));
  ck("the dApp name MetaMask shows is the app's", mm.opt.dapp.name === "UP Wallet (ChainIntegrate)", JSON.stringify(mm.opt.dapp));
  const status = await p.$eval("#complianceBox", (e) => e.textContent);
  ck("the page does not say that no wallet was found", !/non trovato|not found/i.test(status), status);
  const sig = await p.evaluate(async () => {
    const got = [];
    window.addEventListener("eip6963:announceProvider", (e) => got.push(e.detail.provider));
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return got[0].request({ method: "personal_sign", params: ["0x1234", "0x406f822aC86b61d4cDf4cD84833f7e5561609C02"] });
  });
  ck("a signature request goes to MetaMask and its answer comes back", sig === "0x" + "11".repeat(65), sig);
  ck("no page errors (with the test double)", !errs.length, errs.join("\n"));
  await p.close();

  ({ p, errs } = await page(b, null));
  const real = await p.evaluate(() => new Promise((ok) => {
    const got = [];
    window.addEventListener("eip6963:announceProvider", (e) => got.push(e.detail.info.rdns));
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(() => ok(got), 50);
  }));
  ck("real bundle: loads without errors and announces the wallet", real[0] === "it.chainintegrate.upwallet.metamask" && !errs.length, JSON.stringify(real) + errs.join("\n"));

  await b.close();
  console.log(res.join("\n"));
  console.log(`${res.filter((r) => r.startsWith("PASS")).length}/${res.length}`);
  process.exit(res.every((r) => r.startsWith("PASS")) ? 0 : 1);
})().catch((e) => { console.log(res.join("\n")); console.error(e); process.exit(1); });
