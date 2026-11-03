// The signing window (0.10.0): android/app/src/main/assets/signer/ (built from app/signer/ by `npm run web`), as
// SignerActivity loads it, with a fake SignerBridge in place of the native side. Checks that it shows what is
// signed, computes the digest itself from the request, answers only after the arm delay, and gives back the
// signature (or the refusal) through the bridge; and that app/sign-plan.js is the extension's own file.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const { ethers } = require("ethers");

const ROOT = path.join(__dirname, ".."), DIR = path.join(ROOT, "android/app/src/main/assets/signer");
const ORIGIN = "https://appassets.androidplatform.net/assets/signer/";
const res = []; const ck = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"} ${n}${c ? "" : "\n      " + String(x).slice(0, 1200)}`);
const wallet = ethers.Wallet.createRandom();

// The extension's copy, when its repository is checked out next to this one (UPSTREAM.json names the commit).
const ext = [process.env.UPW_EXTENSION_DIR, path.join(ROOT, "../up-wallet-extension")].filter(Boolean).map((d) => path.join(d, "ext/sign-plan.js")).find((f) => fs.existsSync(f));
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

async function open(b, request, lang = "it") {
  const p = await b.newPage({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const errs = [], outside = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (!u.startsWith(ORIGIN)) { outside.push(u); return r.abort(); }
    const f = path.join(DIR, u.slice(ORIGIN.length).split("?")[0]);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: "" });
    r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith(".js") ? "application/javascript" : "text/html" });
  });
  await p.addInitScript(([msg]) => {
    window.__b = { calls: [] };
    window.SignerBridge = {
      request: () => msg,
      sign: (digest, title) => window.__b.calls.push(["sign", digest, title]),
      done: (result) => window.__b.calls.push(["done", result]),
      reject: (code, message) => window.__b.calls.push(["reject", code, message]),
    };
  }, [JSON.stringify({ request, address: wallet.address, lang })]);
  await p.goto(ORIGIN + "signer.html");
  return { p, errs, outside };
}
const calls = (p) => p.evaluate(() => window.__b.calls);
const view = (p) => p.evaluate(() => ({ title: document.getElementById("title").textContent, site: document.getElementById("site").textContent, rows: [...document.querySelectorAll(".row")].map((r) => [r.querySelector(".label").textContent, r.querySelector(".value").textContent]), account: document.getElementById("account").textContent, signDisabled: document.getElementById("sign").disabled, actions: !document.getElementById("actions").hidden, err: document.getElementById("err").hidden ? null : document.getElementById("err").textContent }));

(async () => {
  if (ext) ck("app/sign-plan.js is the extension's own file (ext/sign-plan.js)", sha(ext) === sha(path.join(ROOT, "app/sign-plan.js")), ext);
  else res.push("SKIP app/sign-plan.js against the extension's (no ../up-wallet-extension checkout)");
  const csp = fs.readFileSync(path.join(DIR, "signer.html"), "utf8");
  ck("the window's page: no network (connect-src 'none'), only its own script, no inline script", /default-src 'none'/.test(csp) && /connect-src 'none'/.test(csp) && /script-src 'self'/.test(csp) && !/<script>/.test(csp), csp.match(/<meta http-equiv[^>]+>/));

  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

  // a message: shown, armed after a moment, signed through the bridge
  {
    const { p, errs, outside } = await open(b, { kind: "message", message: ethers.hexlify(ethers.toUtf8Bytes("hello UP")), account: wallet.address, site: "https://dapp.example" });
    const v0 = await view(p);
    ck("a message: its title, the site, the text and the phone key's address are shown", v0.title === "Firma di un messaggio" && /dapp\.example/.test(v0.site) && v0.rows[0][1] === "hello UP" && v0.account.includes(wallet.address) && v0.actions, JSON.stringify(v0));
    ck("the buttons answer only after the arm delay", v0.signDisabled, JSON.stringify(v0));
    await p.click("#sign", { force: true }).catch(() => null);
    ck("a tap before the arm delay does nothing", (await calls(p)).length === 0, JSON.stringify(await calls(p)));
    await p.waitForFunction(() => !document.getElementById("sign").disabled, null, { timeout: 3000 });
    await p.click("#sign");
    const c1 = await calls(p);
    ck("\"Sign\": the native side is asked to sign the digest the window computed (the EIP-191 hash of the message)", c1.length === 1 && c1[0][0] === "sign" && c1[0][1] === ethers.hashMessage("hello UP") && c1[0][2] === "Firma di un messaggio", JSON.stringify(c1));
    // the fingerprint prompt closed: back to the window, nothing answered
    await p.evaluate(() => window.__upwFailed("CANCELED", "canceled"));
    const v1 = await view(p);
    ck("the fingerprint prompt closed: the window stays, it can sign again", !v1.signDisabled && (await calls(p)).length === 1 && v1.err === null, JSON.stringify(v1));
    await p.click("#sign");
    const sig = wallet.signingKey.sign(ethers.hashMessage("hello UP")).serialized;
    await p.evaluate((s) => window.__upwSigned(s), sig);
    const c2 = await calls(p);
    ck("the signature goes back through done(): the answer is the signature, recovering to the key", c2.length === 3 && c2[2][0] === "done" && ethers.verifyMessage("hello UP", JSON.parse(c2[2][1])) === wallet.address, JSON.stringify(c2));
    ck("no request outside the window's own files; no errors", outside.length === 0 && errs.length === 0, JSON.stringify({ outside, errs }));
    await p.close();
  }

  // reject
  {
    const { p } = await open(b, { kind: "message", message: ethers.hexlify(ethers.toUtf8Bytes("no")), account: wallet.address }, "en");
    const v = await view(p);
    ck("in English when the page is", v.title === "Sign a message" && /Phone key/.test(v.account), JSON.stringify(v));
    await p.waitForFunction(() => !document.getElementById("cancel").disabled, null, { timeout: 3000 });
    await p.click("#cancel");
    const c = await calls(p);
    ck("\"Reject\": 4001 to the page, no signature asked", c.length === 1 && c[0][0] === "reject" && c[0][1] === "4001", JSON.stringify(c));
    await p.close();
  }

  // refusals, before anything is shown or signed
  {
    const { p } = await open(b, { kind: "message", message: ethers.hexlify(ethers.randomBytes(32)), account: wallet.address });
    const c = await calls(p);
    ck("an opaque 32-byte message: refused at once (4100), nothing to sign", c.length === 1 && c[0][0] === "reject" && c[0][1] === "4100" && /32 byte/.test(c[0][2]), JSON.stringify(c));
    await p.close();
  }
  {
    const { p } = await open(b, { kind: "message", message: "0x01", account: "0x" + "99".repeat(20) });
    const c = await calls(p);
    ck("another account than the phone key: refused (4100)", c.length === 1 && c[0][1] === "4100", JSON.stringify(c));
    await p.close();
  }
  {
    const data = JSON.stringify({ types: { EIP712Domain: [{ name: "chainId", type: "uint256" }], M: [{ name: "a", type: "uint256" }] }, primaryType: "M", domain: { chainId: 137 }, message: { a: 1 } });
    const { p } = await open(b, { kind: "typed", account: wallet.address, data, chainId: 8453 });
    const c = await calls(p);
    ck("typed data for another network than the page's: refused (4100)", c.length === 1 && c[0][1] === "4100", JSON.stringify(c));
    await p.close();
  }

  // a transaction: the signed transaction is the answer
  {
    const tx = { to: "0x" + "77".repeat(20), value: "10000000000000000", data: "0x", nonce: 7, gasLimit: "21000", chainId: 8453, type: 2, maxFeePerGas: "2000000000", maxPriorityFeePerGas: "1000000" };
    const { p } = await open(b, { kind: "tx", tx, net: { name: "Base", currency: "ETH" }, site: null });
    const v = await view(p);
    ck("a transaction: network, recipient and value shown", v.title === "Transazione su Base" && v.rows.some((r) => r[1] === ethers.getAddress(tx.to)) && v.rows.some((r) => /0\.01 ETH/.test(r[1])), JSON.stringify(v));
    await p.waitForFunction(() => !document.getElementById("sign").disabled, null, { timeout: 3000 });
    await p.click("#sign");
    const [[, digest]] = await calls(p);
    const t = ethers.Transaction.from({ ...tx, chainId: 8453n });
    ck("its digest is the transaction's own unsigned hash", digest === t.unsignedHash, digest);
    await p.evaluate((s) => window.__upwSigned(s), wallet.signingKey.sign(digest).serialized);
    const c = await calls(p);
    const signed = ethers.Transaction.from(JSON.parse(c[1][1]));
    ck("the answer is the signed transaction, from the phone key, for Base", c[1][0] === "done" && signed.from === wallet.address && signed.chainId === 8453n && signed.nonce === 7, JSON.stringify(c));
    await p.close();
  }
  {
    // a signature from another key: the window does not answer with it
    const tx = { to: "0x" + "77".repeat(20), value: "1", data: "0x", nonce: 1, gasLimit: "21000", chainId: 8453, type: 2, maxFeePerGas: "2", maxPriorityFeePerGas: "1" };
    const { p } = await open(b, { kind: "tx", tx, net: { name: "Base", currency: "ETH" } });
    await p.waitForFunction(() => !document.getElementById("sign").disabled, null, { timeout: 3000 });
    await p.click("#sign");
    const [[, digest]] = await calls(p);
    await p.evaluate((s) => window.__upwSigned(s), ethers.Wallet.createRandom().signingKey.sign(digest).serialized);
    const c = await calls(p); const v = await view(p);
    ck("a signature that is not the phone key's: no answer, an error in the window", c.length === 1 && v.err && /signature check failed/.test(v.err), JSON.stringify({ c, v }));
    await p.close();
  }

  // no bridge (the page opened anywhere else): nothing runs
  {
    const p = await b.newPage();
    await p.route("**/*", (r) => { const u = r.request().url(); if (!u.startsWith(ORIGIN)) return r.abort(); const f = path.join(DIR, u.slice(ORIGIN.length)); r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith(".js") ? "application/javascript" : "text/html" }); });
    await p.goto(ORIGIN + "signer.html");
    const hidden = await p.evaluate(() => document.getElementById("actions").hidden && typeof window.UpwSignPlan.plan === "function");
    ck("without the SignerBridge the window shows nothing (only the plan is defined)", hidden);
    await p.close();
  }

  await b.close();
  console.log(res.join("\n"));
  const fails = res.filter((x) => x.startsWith("FAIL")).length;
  const n = res.filter((x) => !x.startsWith("SKIP")).length;
  console.log(fails ? `${fails} FAILED` : `${n}/${n}`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log(res.join("\n")); console.error(e); process.exit(1); });
