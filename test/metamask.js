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
    // RPCs of Base and Polygon: they answer their chain id; the UP has no code (the check stops after the wallet).
    const RPC = { "base-rpc.publicnode.com": "0x2105", "polygon.drpc.org": "0x89" };
    if (RPC[u.host]) {
      const q = JSON.parse(r.request().postData() || "{}");
      const one = (x) => ({ jsonrpc: "2.0", id: x.id, result: x.method === "eth_chainId" ? RPC[u.host] : "0x" });
      return r.fulfill({ contentType: "application/json", body: JSON.stringify(Array.isArray(q) ? q.map(one) : one(q)) });
    }
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
  // A connection kept from an older version, approved for Ethereum only (the "connection not found" case).
  await p.evaluate(() => new Promise((ok) => {
    localStorage.setItem("upwallet.metamask.chains", JSON.stringify(["0x1"]));
    const r = indexedDB.open("mmconnect-kv-store", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => { r.result.close(); ok(); };
  }));
  await p.selectOption("#network", "base");
  await p.fill("#upAddress", "0x4a2605796e0d91A9667d6E30365aEEC384C48c27");
  await p.click("#connectSigner");
  await p.waitForFunction(() => window.__mm && window.__mm.connects && window.__mm.connects.length);
  await p.waitForFunction(() => /chainId 8453/.test(document.getElementById("complianceBox").textContent) && /0x406f/i.test(document.getElementById("complianceBox").textContent), null, { timeout: 5000 }).catch(() => null);
  const mm = await p.evaluate(() => ({ connects: window.__mm.connects, switches: window.__mm.switches, calls: window.__mm.calls, created: window.__mm.created, opt: { ...window.__mm.options, mobile: { useDeeplink: window.__mm.options.mobile.useDeeplink, open: typeof window.__mm.options.mobile.preferredOpenLink } }, events: Object.keys(window.__mm.handlers) }));
  ck("Connect MetaMask: one connection, for the network chosen in the page first (Base), then the main ones",
    mm.connects.length === 1 && mm.connects[0][0] === "0x2105" && ["0x89", "0xa4b1", "0xa86a", "0x1"].every((c) => mm.connects[0].includes(c)), JSON.stringify(mm.connects));
  ck("after connecting, the page reads the chosen network from the wallet (not Ethereum)", mm.calls.includes("eth_chainId"), JSON.stringify(mm.calls));
  ck("the page then follows account and network changes (listeners reach the client)", mm.events.includes("accountsChanged") && mm.events.includes("chainChanged"), JSON.stringify(mm.events));
  ck("one client for the whole session", mm.created === 1, mm.created);
  const store = await p.evaluate(async () => ({ dbs: (await indexedDB.databases()).map((d) => d.name), chains: JSON.parse(localStorage.getItem("upwallet.metamask.chains")) }));
  ck("a connection kept for fewer networks is dropped before connecting; the new networks are recorded",
    !store.dbs.includes("mmconnect-kv-store") && ["0x2105", "0x89", "0xa4b1", "0xa86a", "0x1"].every((c) => store.chains.includes(c)), JSON.stringify(store));
  ck("analytics off; MetaMask opened by metamask:// links through the app", mm.opt.analytics && mm.opt.analytics.enabled === false && mm.opt.mobile.useDeeplink === true && mm.opt.mobile.open === "function", JSON.stringify(mm.opt));
  const nets = mm.opt.api.supportedNetworks;
  ck("networks from chains.js with their RPC (Base, Polygon, Arbitrum, Avalanche, Arc)",
    nets["0x2105"] === "https://base-rpc.publicnode.com" && nets["0x89"] && nets["0xa4b1"] && nets["0xa86a"] && nets["0x13b2"], JSON.stringify(nets).slice(0, 300));
  ck("the dApp name MetaMask shows is the app's", mm.opt.dapp.name === "UP Wallet (ChainIntegrate)", JSON.stringify(mm.opt.dapp));
  const status = await p.$eval("#complianceBox", (e) => e.textContent);
  ck("the page does not say that no wallet was found", !/non trovato|not found/i.test(status), status);
  ck("the page's check: wallet on Base, no \"switch network in MetaMask\" error", /✅ 0x406f822aC86b61d4cDf4cD84833f7e5561609C02 · chainId 8453/.test(status) && !/passa a chainId|switch to chainId/i.test(status), status);
  await p.selectOption("#network", "polygon");
  await p.waitForFunction(() => /chainId 137/.test(document.getElementById("complianceBox").textContent), null, { timeout: 5000 }).catch(() => null);
  const after = await p.evaluate(() => ({ switches: window.__mm.switches, status: document.getElementById("complianceBox").textContent }));
  ck("choosing Polygon in the page moves the MetaMask connection to Polygon", after.switches[after.switches.length - 1] === "0x89", JSON.stringify(after.switches));
  ck("and the page's check sees the wallet on Polygon, no mismatch", /✅ 0x406f822aC86b61d4cDf4cD84833f7e5561609C02 · chainId 137/.test(after.status) && !/passa a chainId|switch to chainId/i.test(after.status), after.status);
  const sig = await p.evaluate(async () => {
    const got = [];
    window.addEventListener("eip6963:announceProvider", (e) => got.push(e.detail.provider));
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return got[0].request({ method: "personal_sign", params: ["0x1234", "0x406f822aC86b61d4cDf4cD84833f7e5561609C02"] });
  });
  ck("a signature request goes to MetaMask and its answer comes back", sig === "0x" + "11".repeat(65), sig);
  const opened = await p.evaluate(async () => {
    const seen = []; window.__upwalletOpenLink = (u) => seen.push(u);
    const open = window.__mm.options.mobile.preferredOpenLink;
    open("metamask://mwp?id=A", "_self"); open("metamask://mwp?id=A", "_self"); open("metamask://mwp?id=B", "_self");
    return seen;
  });
  ck("the same MetaMask link asked twice in a row is opened once (one request shown once in MetaMask)",
    JSON.stringify(opened) === JSON.stringify(["metamask://mwp?id=A", "metamask://mwp?id=B"]), JSON.stringify(opened));
  const logged = await p.$$eval("#log .line-dim", (els) => els.map((e) => e.textContent).join("\n"));
  ck("each opening of MetaMask is noted in the page's log, and so is a skipped repeat",
    (logged.match(/Apertura di MetaMask \(richiesta\)/g) || []).length === 2 && /già aperto, non riaperto/.test(logged), logged);
  const dl = await p.evaluate(() => JSON.parse(localStorage.getItem("upwallet.diag") || "[]").join("\n"));
  ck("diagnostic log: app start, the MetaMask calls with their outcome, the openings", /Avvio dell'app/.test(dl) && /MetaMask → eth_requestAccounts/.test(dl) && /MetaMask ← eth_requestAccounts: ok/.test(dl) && /MetaMask ← personal_sign: ok/.test(dl) && /Apertura di MetaMask \(richiesta\)/.test(dl) && !/0x[0-9a-fA-F]{40}/.test(dl), dl);
  const back = await p.evaluate(async () => {
    let focus = 0; window.addEventListener("focus", () => { focus++; });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));   // a second one right after: not repeated
    await new Promise((r) => setTimeout(r, 50));
    const log = [...document.querySelectorAll("#log .line-dim")].map((e) => e.textContent).filter((t) => /Ritorno nell'app/.test(t));
    return { focus, log: log.length };
  });
  ck("back in the app: the MetaMask connection is renewed once (focus event for MetaMask Connect) and noted in the log", back.focus === 1 && back.log === 1, JSON.stringify(back));
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

  const bundle = fs.readFileSync(path.join(WWW, "app", "metamask.js"), "utf8");
  const m = bundle.match(/requestTimeout:(\w+),connectionTimeout/);
  ck("each MetaMask request may take up to 5 minutes (MetaMask Connect's default is 60 s)",
    m && new RegExp("[,;{(\\s]" + m[1].replace("$", "\\$") + "=300\\*1e3[,;]").test(bundle), m && m[0]);

  ck("MetaMask Connect renews its relay connection on every focus, not only when it believes it is disconnected",
    /onWindowFocus\(\)\{this\.dappClient\.reconnect\(\)\.catch\(/.test(bundle) && !/onWindowFocus\(\)\{this\.isConnected\(\)\|\|/.test(bundle));

  await b.close();
  console.log(res.join("\n"));
  console.log(`${res.filter((r) => r.startsWith("PASS")).length}/${res.length}`);
  process.exit(res.every((r) => r.startsWith("PASS")) ? 0 : 1);
})().catch((e) => { console.log(res.join("\n")); console.error(e); process.exit(1); });
