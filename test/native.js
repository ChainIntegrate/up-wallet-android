// app/native.js in the page (as a web page: the Android parts, like links received from other apps,
// are checked on the phone): Paste button, wc: links found in what is pasted, UP and network
// remembered across restarts, WalletConnect metadata naming the site. Run after `npm run web`.
"use strict";
const fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");

const WWW = path.join(__dirname, "..", "www");
const TYPES = { ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".html": "text/html" };
const res = []; const ck = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"} ${n}${c ? "" : "\n      " + String(x).slice(0, 1200)}`);
const UP = "0x4a2605796e0d91A9667d6E30365aEEC384C48c27";

(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, permissions: ["clipboard-read", "clipboard-write"] });
  const errs = [];
  await ctx.route("**/*", (r) => {
    const u = new URL(r.request().url());
    if (u.host !== "localhost") return r.abort();
    const f = path.join(WWW, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: "" });
    r.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || "application/octet-stream" });
  });
  let p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (d) => { errs.push("dialog: " + d.message()); d.dismiss(); });
  await p.goto("https://localhost/up-wallet.html");
  await p.waitForFunction(() => document.getElementById("wcPaste"));

  const btn = await p.evaluate(() => { const b = document.getElementById("wcPaste"); return { text: b.textContent, after: b.previousElementSibling && b.previousElementSibling.id }; });
  ck("a Paste button right after the WalletConnect link field", btn.text === "Incolla" && btn.after === "wcUri", JSON.stringify(btn));

  const paste = async (text) => {
    await p.evaluate((t) => navigator.clipboard.writeText(t), text);
    await p.evaluate(() => { document.getElementById("wcUri").value = ""; });
    await p.click("#wcPaste");
    await p.waitForTimeout(200);
    return p.$eval("#wcUri", (e) => e.value);
  };
  const LINK = "wc:7f6e5d4c@2?relay-protocol=irn&symKey=0123abcd&expiryTimestamp=1700000000";
  ck("Paste: a plain wc: link, with all its parameters", (await paste(LINK)) === LINK);
  ck("Paste: the link found inside a sentence", (await paste("Connect with this link: " + LINK + " (expires soon)")) === LINK);
  ck("Paste: a link encoded inside another link (…?uri=wc%3A…)", (await paste("https://example.app/wc?uri=" + encodeURIComponent(LINK))) === LINK);
  const before = errs.length;
  ck("Paste without a link: the field stays empty and the user is told", (await paste("hello")) === "" && errs.length === before + 1 && /wc:/.test(errs[errs.length - 1]), errs.slice(before).join("\n"));
  errs.length = before;

  await p.selectOption("#network", "polygon");
  await p.fill("#upAddress", UP);
  await p.reload();
  await p.waitForFunction(() => document.getElementById("wcPaste"));
  const kept = await p.evaluate(() => ({ up: document.getElementById("upAddress").value, net: document.getElementById("network").value }));
  ck("UP address and network remembered at the next start", kept.up === UP && kept.net === "polygon", JSON.stringify(kept));
  await p.fill("#upAddress", "0x123");
  await p.reload();
  await p.waitForFunction(() => document.getElementById("wcPaste"));
  ck("an incomplete address is not remembered (the last valid one stays)", (await p.$eval("#upAddress", (e) => e.value)) === UP);

  // Relay calls on the phone: through the native HTTP stack (here a test double), not the web view's fetch.
  const relay = await p.evaluate(async () => {
    const calls = [];
    window.__upwalletHttp = async (o) => {
      calls.push(o);
      if (o.url.endsWith("relay/send")) return { status: 502, headers: { "content-type": "application/json" }, data: { error: "send failed", notSent: false } };
      if (o.url.includes("relay/receipt")) throw new Error("no network");
      return { status: 200, headers: { "content-type": "application/json" }, data: { ok: true, chains: [8453] } };
    };
    const info = await (await fetch("relay/info", { cache: "no-store" })).json();
    const sent = await fetch("relay/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chainId: 8453, op: { sender: "0x1" } }) });
    const sentBody = await sent.json();
    let failed = null;
    try { await fetch("relay/receipt?hash=0xabc", { cache: "no-store" }); } catch (e) { failed = e.name; }
    window.__upwalletHttp = null;
    return { calls, info, status: sent.status, sentBody, failed };
  });
  const site = "https://crosschain-lukso.chainintegrate.it/";
  ck("relay calls go to the site through native HTTP (GET relay/info)", relay.calls[0].url === site + "relay/info" && relay.calls[0].method === "GET" && relay.info.ok === true, JSON.stringify(relay.calls[0]));
  ck("a POST keeps its JSON body and content type", relay.calls[1].url === site + "relay/send" && relay.calls[1].method === "POST" && relay.calls[1].data.chainId === 8453 && relay.calls[1].headers["content-type"] === "application/json", JSON.stringify(relay.calls[1]));
  ck("the relay's answer reaches the page unchanged (status 502, notSent: false)", relay.status === 502 && relay.sentBody.notSent === false, JSON.stringify(relay));
  ck("a network failure rejects, as fetch does (the page treats it as \"not known whether sent\")", relay.failed === "TypeError", relay.failed);
  const other = await p.evaluate(async () => {
    const calls = []; window.__upwalletHttp = async (o) => { calls.push(o.url); return { status: 200, headers: {}, data: "" }; };
    try { await fetch("https://localhost/chains.js"); } catch (e) { /* not relevant */ }
    window.__upwalletHttp = null; return calls;
  });
  ck("other requests (RPCs, the app's own files) are not touched", other.length === 0, JSON.stringify(other));

  // Notifications for dApp requests while in the background, and the way back to the dApp.
  const nb = await p.evaluate(async () => {
    const sent = [], mins = [];
    window.__upwalletNotify = (n) => sent.push(n.body);
    window.__upwalletMinimize = () => mins.push(1);
    const log = document.getElementById("log");
    const line = (t) => { const d = document.createElement("div"); d.textContent = t; log.appendChild(d); };
    const tick = () => new Promise((r) => setTimeout(r, 30));
    let hidden = true;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    line("Richiesta di connessione da: OpenSea, exchange everything (https://opensea.io) — verifica del dominio: VALID"); await tick();
    line("Richiesta dalla dApp: personal_sign"); await tick();
    line("Richiesta dalla dApp: eth_sendTransaction"); await tick();
    hidden = false;
    line("Richiesta dalla dApp: personal_sign"); await tick();   // in the foreground: no notification
    const btn = document.getElementById("backToDapp");
    const before = btn.hidden;
    line("✅ La UP riconosce la firma come propria. Firma inviata alla dApp."); await tick();
    const shown = !btn.hidden, text = btn.textContent;
    btn.click(); await tick();
    const afterClick = btn.hidden;
    line("Richiesta dalla dApp: eth_sendTransaction"); await tick();
    line("✅ Operazione eseguita."); await tick();
    const shownAgain = !btn.hidden;
    line("Richiesta dalla dApp: personal_sign"); await tick();
    const hiddenOnNew = btn.hidden;
    window.__upwalletNotify = null; window.__upwalletMinimize = null;
    delete document.hidden;
    return { sent, mins: mins.length, before, shown, text, afterClick, shownAgain, hiddenOnNew };
  });
  ck("in the background, each dApp request shows a notification naming the dApp and what it asks",
    JSON.stringify(nb.sent) === JSON.stringify(["opensea.io chiede di collegarsi: tocca per aprire UP Wallet.", "opensea.io chiede una firma: tocca per aprire UP Wallet.", "opensea.io chiede una transazione: tocca per aprire UP Wallet."]), JSON.stringify(nb.sent));
  ck("no notification when UP Wallet is already in the foreground", nb.sent.length === 3);
  ck("\"Back to the dApp\" appears once the dApp has its answer (signature sent, operation done), and hides on a new request",
    nb.before && nb.shown && nb.text === "↩ Torna alla dApp" && nb.afterClick && nb.shownAgain && nb.hiddenOnNew, JSON.stringify(nb));
  ck("\"Back to the dApp\" puts UP Wallet in the background", nb.mins === 1);

  // Keep-alive while a dApp session is active; the MetaMask auto-lock tip.
  const ka = await p.evaluate(async () => {
    const calls = [];
    window.__upwalletKeepAlive = { start: async (o) => calls.push("start: " + o.text), stop: async () => calls.push("stop") };
    const st = document.getElementById("wcStatus");
    const tick = () => new Promise((r) => setTimeout(r, 30));
    st.textContent = "✅ Sessione attiva con OpenSea, exchange everything — token trading (https://opensea.io) — account presentato: 0x4a26 su chainId 8453."; await tick();
    st.textContent = st.textContent + " "; await tick();   // the same session again: no second start
    st.textContent = "Nessuna sessione."; await tick();
    window.__upwalletKeepAlive = null;
    const tip = document.getElementById("mmLockTip");
    return { calls, tip: tip && tip.textContent, after: tip && tip.previousElementSibling && tip.previousElementSibling.id };
  });
  ck("while a dApp session is active the app stays running (one start, named by the dApp's host); stops when none is left",
    JSON.stringify(ka.calls) === JSON.stringify(["start: Collegato a opensea.io: UP Wallet resta attivo per ricevere le richieste.", "stop"]), JSON.stringify(ka.calls));
  ck("panel 3 suggests MetaMask's auto-lock at 5 minutes", ka.after === "connectSigner" && /Blocco automatico a 5 minuti/.test(ka.tip || ""), JSON.stringify(ka));

  // Diagnostic log: kept across restarts, shown under the page's log with Copy and Clear.
  await p.evaluate(() => window.upwDiag.add("marker-before-restart"));
  await p.reload();
  await p.waitForFunction(() => document.getElementById("wcPaste"));
  const diag = await p.evaluate(() => {
    const d = document.querySelector("#log + details");
    return { summary: d && d.querySelector("summary").textContent, text: d && d.querySelector("pre").textContent, buttons: d ? [...d.querySelectorAll("button")].map((b) => b.textContent) : [] };
  });
  ck("diagnostic log survives a restart and shows the restart", diag.summary === "Registro diagnostico (app)" && /marker-before-restart[\s\S]*Avvio dell'app/.test(diag.text) && diag.buttons.join(",") === "Copia,Svuota", JSON.stringify(diag));

  const html = fs.readFileSync(path.join(WWW, "up-wallet.html"), "utf8");
  ck("WalletConnect metadata: dApps are shown the site and its icon, not https://localhost",
    html.includes('url: "https://crosschain-lukso.chainintegrate.it",') && html.includes('icons: ["https://crosschain-lukso.chainintegrate.it/favicon.ico"]') && !/url: location\.origin/.test(html));
  ck("the WalletConnect Project ID is in the app's config", /walletConnectProjectId": "[0-9a-f]{32}"/.test(fs.readFileSync(path.join(WWW, "config.js"), "utf8")));
  const notice = await p.evaluate(() => { const d = document.getElementById("appNotice"); return d && { text: d.textContent, href: d.querySelector("a").href, privacy: d.querySelectorAll("a")[1].href, after: d.previousElementSibling.className }; });
  ck("MetaMask Connect's notice under the page footer, with links to the third-party notices and the privacy policy",
    notice && /MetaMask Connect, © ConsenSys Software Inc\./.test(notice.text) && /10\.000 utenti/.test(notice.text) && notice.after === "site-footer"
    && notice.href === "https://github.com/ChainIntegrate/up-wallet-android/blob/main/THIRD_PARTY_NOTICES.md"
    && notice.privacy === "https://crosschain-lukso.chainintegrate.it/up-wallet-app-privacy.html", JSON.stringify(notice));
  ck("no page errors", !errs.length, errs.join("\n"));

  await b.close();
  console.log(res.join("\n"));
  console.log(`${res.filter((r) => r.startsWith("PASS")).length}/${res.length}`);
  process.exit(res.every((r) => r.startsWith("PASS")) ? 0 : 1);
})().catch((e) => { console.log(res.join("\n")); console.error(e); process.exit(1); });
