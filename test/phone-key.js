// app/phone-key.js with the page (0.9.0): the page finds the phone key as its signing wallet; messages,
// typed data and transactions are hashed in the page, signed by the PhoneKey plugin (here a mock with an
// ethers wallet, window.__upwalletPhoneKey), and transactions are sent to the network's RPC (mocked).
// The native signing itself (Secp256k1.java) is checked against ethers by test/secp256k1/. Run after `npm run web`.
"use strict";
const fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const { ethers } = require("ethers");

const ROOT = path.join(__dirname, ".."), WWW = path.join(ROOT, "www");
const TYPES = { ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".html": "text/html" };
const res = []; const ck = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"} ${n}${c ? "" : "\n      " + String(x).slice(0, 1200)}`);
const UP = "0x4a2605796e0d91A9667d6E30365aEEC384C48c27", TO = "0x" + "77".repeat(20);

(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const p = await b.newPage({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const raws = [];
  await p.route("**/*", (r) => {
    const u = new URL(r.request().url());
    const RPC = { "base-rpc.publicnode.com": 8453, "polygon-bor-rpc.publicnode.com": 137, "rpc.mainnet.lukso.network": 42, "rpc.testnet.lukso.network": 4201, "my-rpc.test": 4201 };
    if (RPC[u.host]) {
      const q = JSON.parse(r.request().postData() || "{}");
      const one = (x) => {
        const ok = (v) => ({ jsonrpc: "2.0", id: x.id, result: v });
        switch (x.method) {
          case "eth_chainId": return ok("0x" + RPC[u.host].toString(16));
          case "eth_getTransactionCount": return ok("0x7");
          case "eth_estimateGas": return ok("0x5208");
          case "eth_gasPrice": return ok("0x3b9aca00");
          case "eth_maxPriorityFeePerGas": return ok("0x5f5e100");
          case "eth_getBlockByNumber": return ok({ number: "0x10", hash: "0x" + "ab".repeat(32), parentHash: "0x" + "cd".repeat(32), timestamp: "0x6700", nonce: "0x0000000000000000", difficulty: "0x0", gasLimit: "0x1c9c380", gasUsed: "0x0", miner: "0x" + "00".repeat(20), extraData: "0x", baseFeePerGas: "0x3b9aca00", transactions: [] });
          case "eth_sendRawTransaction": raws.push(x.params[0]); return ok(ethers.keccak256(x.params[0]));
          case "eth_getCode": return ok("0x");
          default: return ok("0x");
        }
      };
      return r.fulfill({ contentType: "application/json", body: JSON.stringify(Array.isArray(q) ? q.map(one) : one(q)) });
    }
    if (u.host !== "localhost") return r.abort();
    const f = path.join(WWW, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: "" });
    r.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || "application/octet-stream" });
  });
  await p.addInitScript(() => {
    try { localStorage.setItem("upwallet.riskAccepted", "1"); localStorage.setItem("upwallet.view", "all"); localStorage.setItem("upwallet.lang", "it"); } catch (e) { /* none */ }
    // The PhoneKey plugin, mocked: an ethers wallet in place of the Keystore; each prompt is recorded.
    window.__pk = { wallet: null, prompts: [], cancel: false };
    window.__upwalletPhoneKey = {
      async status() { const w = window.__pk.wallet; return { exists: !!w, address: w ? w.address.toLowerCase() : null, hardware: w ? "tee" : null, canAuth: true }; },
      async create(o) { window.__pk.prompts.push(["create", o.subtitle]); if (window.__pk.cancel) throw Object.assign(new Error("canceled"), { code: "CANCELED" }); window.__pk.wallet = ethers.Wallet.createRandom(); return { address: window.__pk.wallet.address.toLowerCase() }; },
      async sign(o) {
        window.__pk.prompts.push(["sign", o.subtitle, o.digest, o.description]);
        if (window.__pk.cancel) throw Object.assign(new Error("canceled"), { code: "CANCELED" });
        if (!window.__pk.wallet) throw Object.assign(new Error("no key"), { code: "NO_KEY" });
        return { signature: window.__pk.wallet.signingKey.sign(o.digest).serialized };
      },
      async remove() { window.__pk.wallet = null; },
    };
  });
  await p.goto("https://localhost/up-wallet.html");
  await p.waitForFunction(() => typeof ethers !== "undefined" && document.getElementById("connectSigner"));

  const seen = await p.evaluate(() => new Promise((ok) => {
    const got = [];
    window.addEventListener("eip6963:announceProvider", (e) => got.push(e.detail.info.name));
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(() => ok(got), 50);
  }));
  ck("announced through EIP-6963 as the phone key, the only wallet (no MetaMask)", seen.length === 1 && seen[0] === "Phone key (UP Wallet)", JSON.stringify(seen));
  const warn = await p.evaluate(() => { const w = document.getElementById("pkWarn"); return w ? w.innerText : null; });
  ck("at the first start, the warning: experimental, the maintainer's wallet, higher risk, MIT without warranty, no copy of the key", !!warn && /wallet sperimentale/.test(warn) && /rischio è più alto/.test(warn) && /MIT, senza garanzie/.test(warn) && /non ha copie/.test(warn), warn);
  await p.click("#pkWarnOk");
  ck("accepted once: not shown again", await p.evaluate(() => !document.getElementById("pkWarn") && localStorage.getItem("upwallet.phonekey.ack") === "1"));
  const before = await p.evaluate(() => ({ btn: document.getElementById("connectSigner").textContent, panel: (document.getElementById("pkPanel") || {}).innerText || "" }));
  ck("panel 3: \"Use the phone key\", and no key yet", before.btn === "Usa la chiave del telefono" && /Nessuna chiave del telefono/.test(before.panel), JSON.stringify(before));

  const texts = await p.evaluate(() => ({ cls: document.documentElement.classList.contains("phone-key"), p3: document.querySelector('[data-i18n="panel3Title"]').textContent, ready: t("readyToSend"), perms: t("permsNone"), body: document.body.innerText }));
  const relayText = await p.evaluate(() => ({ ask: GasRelayClient.text("signAsk", { hash: "0x01" }), note: GasRelayClient.text("optionNote", { pm: "PM" }) }));
  ck("the gas relay's texts name the phone key too (no MetaMask)", /chiave del telefono firma il messaggio 0x01/.test(relayText.ask) && /impronta/.test(relayText.note) && !/MetaMask/.test(relayText.ask + relayText.note), JSON.stringify(relayText));
  ck("the page's texts name the phone key, not MetaMask (html.phone-key)", texts.cls && texts.p3 === "3 · Controller (chiave del telefono) e verifica" && /conferma con l'impronta/.test(texts.ready) && /Autorizza un dispositivo/.test(texts.perms)
    && !/MetaMask/.test(texts.body.replace(/Nessuna affiliazione[^.]*\./, "")), JSON.stringify({ ...texts, body: (texts.body.match(/.{0,80}MetaMask.{0,80}/g) || []).join(" | ") }));
  await p.selectOption("#network", "base");
  await p.fill("#upAddress", UP);
  await p.click("#connectSigner");
  await p.waitForFunction(() => window.__pk.wallet && typeof signerAddress !== "undefined" && signerAddress, null, { timeout: 5000 });
  const st = await p.evaluate(() => ({ addr: window.__pk.wallet.address, signer: signerAddress, prompts: window.__pk.prompts, panel: document.getElementById("pkPanel").innerText, link: [...document.querySelectorAll("#pkPanel a")].map((a) => a.href) }));
  ck("connect: the key is created after the fingerprint prompt, and the page uses its address as the controller", st.prompts.length === 1 && st.prompts[0][0] === "create" && st.signer.toLowerCase() === st.addr.toLowerCase(), JSON.stringify(st));
  ck("the panel shows the address, where it is kept, and how to authorize it on the site", st.panel.includes(st.addr) && /hardware sicuro/.test(st.panel) && /pagina Backup del sito/.test(st.panel), st.panel);
  const lk = new URL(st.link[0]);
  ck("the Backup link carries the phone's address, the UP and the network", lk.pathname.endsWith("/up-backup.html") && lk.searchParams.get("phone") === st.addr && lk.searchParams.get("up") === UP && lk.searchParams.get("network") === "base", st.link[0]);

  // signatures, through ethers as the page does
  const sig = await p.evaluate(async () => {
    const s = await new ethers.BrowserProvider(signerProvider).getSigner();
    const msg = await s.signMessage("hello UP");
    const typed = await s.signTypedData({ name: "T", version: "1", chainId: 8453, verifyingContract: "0x" + "11".repeat(20) }, { Mail: [{ name: "to", type: "address" }, { name: "body", type: "string" }] }, { to: "0x" + "22".repeat(20), body: "hi" });
    const n0 = window.__pk.prompts.length;
    let r32; try { await signerProvider.request({ method: "personal_sign", params: [ethers.hexlify(ethers.randomBytes(32)), s.address] }); r32 = "signed"; } catch (e) { r32 = [e.code, e.message]; }
    return { addr: s.address, msg, typed, r32, asked32: window.__pk.prompts.length !== n0, prompts: window.__pk.prompts.slice(1).map((x) => x[1]), descs: window.__pk.prompts.slice(1).map((x) => x[3]) };
  });
  ck("personal_sign: signed by the phone key (recovers to its address)", ethers.verifyMessage("hello UP", sig.msg) === sig.addr, JSON.stringify(sig));
  ck("eth_signTypedData_v4: EIP-712 digest signed by the phone key", ethers.verifyTypedData({ name: "T", version: "1", chainId: 8453, verifyingContract: "0x" + "11".repeat(20) }, { Mail: [{ name: "to", type: "address" }, { name: "body", type: "string" }] }, { to: "0x" + "22".repeat(20), body: "hi" }, sig.typed) === sig.addr, JSON.stringify(sig));
  ck("the fingerprint prompt says what is signed", sig.prompts[0] === "Firma di un messaggio" && /Firma di dati strutturati \(Mail\)/.test(sig.prompts[1]), JSON.stringify(sig.prompts));
  ck("PK-4: the prompt shows the message's text, and the typed data's domain (name, chain, contract)", sig.descs[0] === '"hello UP"' && sig.descs[1] === "T · rete 8453 · contratto 0x1111…1111", JSON.stringify(sig.descs));
  ck("PK-2: an opaque 32-byte message is refused by the key itself, without asking for the fingerprint", Array.isArray(sig.r32) && sig.r32[0] === 4100 && /32 byte/.test(sig.r32[1]) && !sig.asked32, JSON.stringify(sig.r32));

  // a transaction: built for the page's network, signed, sent raw to its RPC
  const tx = await p.evaluate(async (TO) => {
    const s = await new ethers.BrowserProvider(signerProvider).getSigner();
    const r = await signerProvider.request({ method: "eth_sendTransaction", params: [{ from: s.address, to: TO, value: "0x2386f26fc10000", data: "0x1234", chainId: "0x2105", gas: "0x9c40" }] });
    return { hash: r, prompt: window.__pk.prompts.at(-1)[1] };
  }, TO);
  const t = ethers.Transaction.from(raws[0] || "0x");
  ck("eth_sendTransaction: a signed EIP-1559 transaction for Base, from the phone key, with the page's fields and the RPC's nonce, sent raw",
    raws.length === 1 && t.from === sig.addr && t.chainId === 8453n && t.to === ethers.getAddress(TO) && t.value === 10n ** 16n && t.data === "0x1234" && t.gasLimit === 40000n && t.nonce === 7 && t.type === 2 && tx.hash === ethers.keccak256(raws[0]), JSON.stringify({ raw: raws[0], from: raws[0] && t.from }));
  ck("the prompt names the network, the recipient and the value", /Transazione su Base verso 0x7777…7777, 0\.01 ETH/.test(tx.prompt), tx.prompt);
  const txDesc = await p.evaluate(() => window.__pk.prompts.at(-1)[3]);
  ck("PK-4: and the function it calls", txDesc === "Chiama la funzione 0x1234", txDesc);

  // PK-2: an ERC-4337 operation of the UP, through the gas relay client: the key computes the hash itself
  const EP = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
  const upIface = new ethers.Interface(["function execute(uint256,address,uint256,bytes)"]);
  const op = { sender: UP, nonce: 3n, initCode: "0x", callData: upIface.encodeFunctionData("execute", [0, TO, 10n ** 16n, "0x12345678"]), callGasLimit: 100000n, verificationGasLimit: 300000n,
    preVerificationGas: 60000n, maxFeePerGas: 2000000000n, maxPriorityFeePerGas: 1000000n, paymasterAndData: "0x" + "ab".repeat(20), signature: "0x" };
  const enc = (t, v) => ethers.AbiCoder.defaultAbiCoder().encode(t, v);
  const opHash = (o, chainId) => ethers.keccak256(enc(["bytes32", "address", "uint256"], [ethers.keccak256(enc(
    ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
    [o.sender, o.nonce, ethers.keccak256(o.initCode), ethers.keccak256(o.callData), o.callGasLimit, o.verificationGasLimit, o.preVerificationGas, o.maxFeePerGas, o.maxPriorityFeePerGas, ethers.keccak256(o.paymasterAndData)])), EP, chainId]));
  const H = opHash(op, 8453n);
  const ser = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]));
  const relay = await p.evaluate(async ([o, H]) => {
    const op = Object.fromEntries(Object.entries(o).map(([k, v]) => [k, /^\d+$/.test(v) ? BigInt(v) : v]));
    const prep = { chainId: 8453, op, hash: H, view: {}, sponsor: null };
    const logs = [];
    let err = null;
    try { await GasRelayClient.signAndSend(signerProvider, { chainId: 8453, prep, signer: signerAddress, log: (m) => logs.push(m) }); } catch (e) { err = e.message; }
    const pr = window.__pk.prompts.at(-1);
    return { sig: prep.op.signature, logs, err, subtitle: pr[1], desc: pr[3] };
  }, [ser(op), H]);
  ck("PK-2: the gas relay has the phone key sign the operation (upwallet_signUserOperation): the signature is the personal_sign of the hash the page computed",
    ethers.isHexString(relay.sig, 65) && ethers.verifyMessage(ethers.getBytes(H), relay.sig) === sig.addr && relay.logs.some((m) => /firmato/i.test(m)), JSON.stringify(relay));
  ck("PK-4: its prompt says the operation, the UP, the recipient, the value, the function and who pays the gas", relay.subtitle === "Operazione della UP su Base" && relay.desc === "UP 0x4a26…8c27: verso 0x7777…7777, 0.01 ETH, funzione 0x12345678. Gas pagato dal sito.", JSON.stringify([relay.subtitle, relay.desc]));
  const opRefusals = await p.evaluate(async ([o]) => {
    const call = async (x) => { const n = window.__pk.prompts.length; try { await signerProvider.request({ method: "upwallet_signUserOperation", params: [x] }); return "signed"; } catch (e) { return [e.code, window.__pk.prompts.length === n]; } };
    return {
      otherUp: await call({ op: { ...o, sender: "0x" + "55".repeat(20) }, entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", chainId: 8453 }),
      otherEp: await call({ op: o, entryPoint: "0x" + "66".repeat(20), chainId: 8453 }),
      otherChain: await call({ op: o, entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", chainId: 137 }),
    };
  }, [ser(op)]);
  ck("PK-2: an operation of another UP, for another EntryPoint or another network is refused, without asking for the fingerprint",
    opRefusals.otherUp[0] === 4100 && opRefusals.otherUp[1] && opRefusals.otherEp[0] === -32602 && opRefusals.otherEp[1] && opRefusals.otherChain[0] === 4901 && opRefusals.otherChain[1], JSON.stringify(opRefusals));
  const methods = await p.evaluate(async () => {
    const call = async (m, params) => { try { return await signerProvider.request({ method: m, params }); } catch (e) { return e.code; } };
    return { bal: await call("eth_getBalance", ["0x" + "77".repeat(20), "latest"]), raw: await call("eth_sendRawTransaction", ["0x00"]), other: await call("debug_traceTransaction", ["0x00"]) };
  });
  ck("only read methods reach the network's RPC; others are refused (4200)", methods.bal === "0x" && methods.raw === 4200 && methods.other === 4200, JSON.stringify(methods));
  const wrong = await p.evaluate(async () => { try { await signerProvider.request({ method: "eth_sendTransaction", params: [{ to: "0x" + "77".repeat(20), chainId: "0x89" }] }); return "sent"; } catch (e) { return e.code; } });
  ck("a transaction for another network than the page's is refused (4901)", wrong === 4901, String(wrong));

  // cancel, networks, refusals
  const cancel = await p.evaluate(async () => { window.__pk.cancel = true; try { await signerProvider.request({ method: "personal_sign", params: ["0x01", window.__pk.wallet.address] }); return "signed"; } catch (e) { return e.code; } finally { window.__pk.cancel = false; } });
  ck("the prompt closed by the user: 4001 (user rejected), as a wallet answers", cancel === 4001, String(cancel));
  const other = await p.evaluate(async () => { try { await signerProvider.request({ method: "personal_sign", params: ["0x01", "0x" + "99".repeat(20)] }); return "signed"; } catch (e) { return e.code; } });
  ck("a signature for another account: refused", other === 4100, String(other));
  const ethSign = await p.evaluate(async () => { try { await signerProvider.request({ method: "eth_sign", params: [] }); return "signed"; } catch (e) { return e.code; } });
  ck("eth_sign: not supported (4200)", ethSign === 4200, String(ethSign));
  const net = await p.evaluate(async () => {
    const got = []; signerProvider.on("chainChanged", (c) => got.push(c));
    const a = await signerProvider.request({ method: "eth_chainId" });
    let sw; try { await signerProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x89" }] }); sw = "ok"; } catch (e) { sw = e.code; }
    const el = document.getElementById("network"); el.value = "polygon"; el.dispatchEvent(new Event("change"));
    const b = await signerProvider.request({ method: "eth_chainId" });
    return { a, sw, b, got };
  });
  ck("the phone key follows the network chosen in the page: chain id, chainChanged; another network is not switched to from outside (4902)", net.a === "0x2105" && net.sw === 4902 && net.b === "0x89" && net.got.includes("0x89"), JSON.stringify(net));
  // LUKSO Testnet in the page's list, and a custom RPC: the chain id the RPC reports, not 1
  const nets2 = await p.evaluate(async () => {
    const got = []; signerProvider.on("chainChanged", (c) => got.push(c));
    const el = document.getElementById("network");
    const listed = [...el.options].some((o) => o.value === "lukso-testnet");
    el.value = "lukso-testnet"; el.dispatchEvent(new Event("change"));
    const t = await signerProvider.request({ method: "eth_chainId" });
    el.value = "custom"; el.dispatchEvent(new Event("change"));
    const empty = await signerProvider.request({ method: "eth_chainId" });
    const r = document.getElementById("customRpc"); r.value = "https://my-rpc.test/"; r.dispatchEvent(new Event("input")); r.dispatchEvent(new Event("change"));
    const c = await signerProvider.request({ method: "eth_chainId" });
    await new Promise((ok) => setTimeout(ok, 100));
    const s = await new ethers.BrowserProvider(signerProvider).getSigner();
    await signerProvider.request({ method: "eth_sendTransaction", params: [{ from: s.address, to: "0x" + "77".repeat(20), value: "0x1", gas: "0x5208" }] });
    return { listed, t, empty, c, got };
  });
  const tc = ethers.Transaction.from(raws.at(-1));
  ck("LUKSO Testnet is in the page's list: chain id 4201", nets2.listed && nets2.t === "0x1069", JSON.stringify(nets2));
  ck("a custom RPC: the phone key answers the chain id the RPC reports (4201), tells the page (chainChanged), and signs transactions for it", nets2.c === "0x1069" && nets2.got.includes("0x1069") && tc.chainId === 4201n && tc.from === sig.addr, JSON.stringify({ ...nets2, chainId: String(tc.chainId) }));

  // delete
  p.on("dialog", (d) => d.accept());
  await p.evaluate(() => { [...document.querySelectorAll("#pkPanel button")].find((x) => /Elimina/.test(x.textContent)).click(); });
  await p.waitForFunction(() => !window.__pk.wallet && /Nessuna chiave/.test(document.getElementById("pkPanel").innerText));
  ck("delete (after a confirmation that says to revoke it first): no key left", true);
  ck("no page errors", errs.length === 0, errs.join(" | "));

  await b.close();
  console.log(res.join("\n"));
  const fails = res.filter((x) => x.startsWith("FAIL")).length;
  console.log(fails ? `${fails} FAILED` : `${res.length}/${res.length}`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
