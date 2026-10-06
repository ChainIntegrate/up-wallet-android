// The app's web content at phone width: it loads without errors, nothing is wider than the screen even
// with long addresses and hashes in the request window, the status boxes and the log; relay calls and
// links to the site's other pages go to the site. Run after `npm run web`.
//   PLAYWRIGHT=/path/to/playwright CHROMIUM=/path/to/chrome node test/mobile-layout.js
"use strict";
const fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");

const WWW = path.join(__dirname, "..", "www");
const SITE = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app-config.json"), "utf8")).site;
const TYPES = { ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".html": "text/html" };
const res = []; const ck = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"} ${n}${c ? "" : "\n      " + String(x).slice(0, 1200)}`);

(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const errs = [], outside = [];
  const p = await b.newPage({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  p.on("pageerror", (e) => errs.push(e.message));
  await p.route("**/*", (r) => {
    const u = new URL(r.request().url());
    if (u.host !== "localhost") { outside.push(u.href); return r.fulfill({ status: 503, body: "" }); }
    const f = path.join(WWW, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
    if (!f.startsWith(WWW) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: "" });
    r.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || "application/octet-stream" });
  });
  await p.goto("https://localhost/");
  await p.waitForFunction(() => location.pathname === "/up-wallet.html" && typeof ethers !== "undefined" && document.querySelector("#requestModal"));
  await p.waitForTimeout(300);
  ck("index.html opens the wallet page; ethers, the page scripts and the app shim are loaded",
    await p.evaluate(() => document.documentElement.classList.contains("in-app") && typeof GasRelayClient !== "undefined" && typeof CHAINS !== "undefined"));
  ck("no request to a CDN: everything the page loads is in the app",
    !outside.some((u) => !u.startsWith(SITE)), outside.join("\n"));

  const H = "0xc8c727c4501daad5a3f788461f19f36f9fd2a548ee07ce6fbf51dfd75811142f";
  const LINK = "https://basescan.org/tx/" + H;
  await p.evaluate(([H, LINK]) => {
    document.querySelectorAll(".status-box").forEach((e) => { e.hidden = false; e.textContent = "Firma in MetaMask il messaggio " + H + " (nessun gas) " + LINK; });
    const m = document.getElementById("requestModal"); m.hidden = false;
    document.getElementById("modalNotes").textContent = "Riepilogo: verso 0x0000000000000068F116a894984e2DB1123eB395 (Seaport 1.6 (OpenSea))\nHash " + H + "\n" + LINK;
    document.getElementById("modalDetails").textContent = "0x" + "ab".repeat(400);
    document.getElementById("log").textContent = "Transazione del relayer: " + H + "\n" + LINK;
  }, [H, LINK]);
  const lay = await p.evaluate(() => {
    const W = document.documentElement.clientWidth, wide = [];
    document.querySelectorAll("body *").forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && r.right > W + 1) wide.push(`${e.tagName}#${e.id}.${e.className} ${Math.round(r.right)}`); });
    const btn = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.left >= 0 && r.right <= W && r.bottom <= innerHeight; };
    return { W, sw: document.documentElement.scrollWidth, wide, reject: btn("rejectBtn") };
  });
  ck("long hashes, addresses and links: nothing wider than the screen", lay.sw <= lay.W && !lay.wide.length, JSON.stringify(lay));
  ck("request window: the Reject button is fully on screen", lay.reject, JSON.stringify(lay));

  const sent = [];
  await p.unroute("**/*");
  await p.route("**/*", (r) => { sent.push(r.request().url()); r.fulfill({ status: 200, contentType: "application/json", body: "{}" }); });
  await p.evaluate(() => fetch("relay/info").catch(() => null));
  ck("relay calls go to the site", sent.includes(SITE + "relay/info"), sent.join("\n"));
  const href = await p.evaluate(() => {
    const a = document.createElement("a"); a.href = "up-crosschain-guide.html#wallet"; a.textContent = "x"; document.body.appendChild(a);
    a.addEventListener("click", (e) => e.preventDefault());
    a.click(); return a.href;
  });
  ck("a link to another page of the site opens that page on the site", href === SITE + "up-crosschain-guide.html#wallet", href);

  ck("no page errors", !errs.length, errs.join("\n"));
  await b.close();
  console.log(res.join("\n"));
  console.log(`${res.filter((r) => r.startsWith("PASS")).length}/${res.length}`);
  process.exit(res.every((r) => r.startsWith("PASS")) ? 0 : 1);
})().catch((e) => { console.log(res.join("\n")); console.error(e); process.exit(1); });
