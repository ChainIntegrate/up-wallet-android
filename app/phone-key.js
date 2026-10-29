// UP Wallet app (from 0.9.0): the phone key as the page's signing wallet, instead of MetaMask.
// The key is a controller of the UP, created and kept on this phone by the native PhoneKey plugin
// (PhoneKeyPlugin.java): encrypted with the Android Keystore and unlocked by the fingerprint (or PIN) for
// every signature, the signature made in native code. This file only builds what is signed (the 32-byte
// digest of a message, typed data or transaction), asks the plugin for the signature, and sends signed
// transactions to the network's RPC. It is announced to the page through EIP-6963, as the browser
// extension is: the page uses it as any wallet, its checks and confirmation window unchanged.
// It also adds, under the page's "connect" button: the phone key's address (copy, QR), the link to the
// site's Backup page that authorizes it on the UP, and the warning shown until accepted.
// Bundled by scripts/build-web.js (esbuild) into www/app/phone-key.js; loaded after chains.js.
import { Capacitor, registerPlugin } from "@capacitor/core";

// The page's texts name the phone key instead of MetaMask (up-wallet.html, PHONE_I18N).
document.documentElement.classList.add("phone-key");
const PK = window.__upwalletPhoneKey || (Capacitor.isNativePlatform() ? registerPlugin("PhoneKey") : null);   // __upwalletPhoneKey: tests
const SITE = window.__upwalletSite || "https://crosschain-lukso.chainintegrate.it/";
const ACK_KEY = "upwallet.phonekey.ack";
const ACK_VERSION = "1";
const INFO = Object.freeze({
  uuid: "0b6a9c52-6f0e-4d3b-9f43-8c4a6f1d2e71",
  name: "Phone key (UP Wallet)",
  icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='9' y='3' width='14' height='26' rx='3' fill='%233b82f6'/%3E%3C/svg%3E",
  rdns: "it.chainintegrate.upwallet.phonekey",
});

const en = () => document.documentElement.lang === "en";
const diag = (t) => { if (window.upwDiag) window.upwDiag.add(t); };
const $ = (id) => document.getElementById(id);
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const T = {
  connect: () => (en() ? "Use the phone key" : "Usa la chiave del telefono"),
  title: () => (en() ? "This phone" : "Questo telefono"),
  none: () => (en() ? "No phone key yet: it is created when you press \"Use the phone key\" (fingerprint or PIN)." : "Nessuna chiave del telefono: si crea quando premi \"Usa la chiave del telefono\" (impronta o PIN)."),
  addr: (a, hw) => (en() ? `Phone key: ${a}` : `Chiave del telefono: ${a}`) + (hw ? ` · ${hw === "strongbox" ? "StrongBox" : hw === "tee" ? (en() ? "secure hardware" : "hardware sicuro") : (en() ? "software only" : "solo software")}` : ""),
  authHint: () => (en()
    ? "To use it, authorize it once on each network where the UP exists: on a computer, the site's Backup page, \"Authorize a device\", signed by an admin controller of the UP (for example in MetaMask). A lost phone is revoked from the same page."
    : "Per usarla, autorizzala una volta su ogni rete dove esiste la UP: dal computer, pagina Backup del sito, \"Autorizza un dispositivo\", firmato da un controller amministratore della UP (per esempio in MetaMask). Un telefono perso si revoca dalla stessa pagina."),
  copy: () => (en() ? "Copy address" : "Copia indirizzo"),
  copied: () => (en() ? "Copied" : "Copiato"),
  qr: () => (en() ? "Show QR" : "Mostra QR"),
  open: () => (en() ? "Open the Backup page" : "Apri la pagina Backup"),
  remove: () => (en() ? "Delete the phone key" : "Elimina la chiave del telefono"),
  named: (name, net) => (en() ? `Name on the UP (${net}): ${name}` : `Nome sulla UP (${net}): ${name}`),
  unnamed: (net) => (en() ? `No name on the UP on ${net}: it can be given from the Backup page.` : `Nessun nome sulla UP su ${net}: si può dare dalla pagina Backup.`),
  bal: (v, net) => (en() ? `The key's own balance on ${net}: ${v}` : `Saldo della chiave su ${net}: ${v}`),
  sweep: () => (en() ? "Send the key's balance to the UP" : "Manda il saldo della chiave alla UP"),
  sweepNoUp: () => (en() ? "Choose the UP in the page first." : "Prima scegli la UP nella pagina."),
  sweepLow: () => (en() ? "The balance does not cover the transfer's fee." : "Il saldo non copre la commissione del trasferimento."),
  sweepSent: (h) => (en() ? `Sent to the UP: ${h}` : `Inviato alla UP: ${h}`),
  txKm: (what) => (en() ? `Through the UP's Key Manager: ${what}` : `Tramite il Key Manager della UP: ${what}`),
  removeAsk: () => (en()
    ? "Delete the phone key from this phone? It cannot be recovered. First send its balance to the UP (\"This phone\", on every network where it has some) and revoke it on every network (site, Backup page), or it stays a controller of the UP that nobody can use."
    : "Eliminare la chiave del telefono? Non si può recuperare. Prima manda alla UP il suo saldo (\"Questo telefono\", su ogni rete dove ne ha) e revocala su ogni rete (sito, pagina Backup), altrimenti resta un controller della UP che nessuno può usare."),
  noAuth: () => (en() ? "Set up a fingerprint or a screen lock on the phone first." : "Prima imposta un'impronta o un blocco schermo sul telefono."),
  invalidated: () => (en()
    ? "The phone key can no longer be unlocked (the screen lock was changed or removed). Delete it, create a new one, and revoke the old address from the site's Backup page."
    : "La chiave del telefono non si può più sbloccare (il blocco schermo è stato cambiato o tolto). Eliminala, creane una nuova e revoca il vecchio indirizzo dalla pagina Backup del sito."),
  promptCreate: () => (en() ? "Create the phone key" : "Crea la chiave del telefono"),
  promptDesc: () => (en() ? "The key stays on this phone, encrypted. It signs only after your confirmation." : "La chiave resta su questo telefono, cifrata. Firma solo dopo la tua conferma."),
  cancel: () => (en() ? "Cancel" : "Annulla"),
  signMsg: () => (en() ? "Sign a message" : "Firma di un messaggio"),
  msgBytes: (n, h) => (en() ? `${n} bytes, not text: ${h}` : `${n} byte, non testo: ${h}`),
  typedDomain: (name, chain, contract) => [name, chain ? (en() ? `chain ${chain}` : `rete ${chain}`) : "", contract ? (en() ? `contract ${contract}` : `contratto ${contract}`) : ""].filter(Boolean).join(" · "),
  txData: (sel) => (sel ? (en() ? `Calls the function ${sel}` : `Chiama la funzione ${sel}`) : (en() ? "No data: a plain transfer" : "Nessun dato: un semplice invio")),
  signOp: (net) => (en() ? `Operation of the UP on ${net}` : `Operazione della UP su ${net}`),
  opWhat: (up, what) => (en() ? `UP ${up}: ${what}. Gas paid by the site.` : `UP ${up}: ${what}. Gas pagato dal sito.`),
  opCall: (to, v, sel) => (en() ? `to ${to}` : `verso ${to}`) + (v ? `, ${v}` : "") + (sel ? (en() ? `, function ${sel}` : `, funzione ${sel}`) : ""),
  opBatch: (n) => (en() ? `${n} calls in one operation` : `${n} chiamate in un'operazione`),
  opOther: (sel) => (en() ? `UP function ${sel}` : `funzione della UP ${sel}`),
  opaque32: () => (en()
    ? "The phone key does not sign an opaque 32-byte message: it could authorize an operation of the UP on another network."
    : "La chiave del telefono non firma un messaggio opaco di 32 byte: potrebbe autorizzare un'operazione della UP su un'altra rete."),
  badOp: (why) => (en() ? `Operation not signed: ${why}` : `Operazione non firmata: ${why}`),
  signTyped: (p) => (en() ? `Sign typed data (${p})` : `Firma di dati strutturati (${p})`),
  signTx: (net, to, v) => (en() ? `Transaction on ${net} to ${to}${v ? `, ${v}` : ""}` : `Transazione su ${net} verso ${to}${v ? `, ${v}` : ""}`),
  noSite: () => (en() ? "No network chosen in the page." : "Nessuna rete scelta nella pagina."),
  warnTitle: () => (en() ? "UP Wallet 0.9: experimental wallet" : "UP Wallet 0.9: wallet sperimentale"),
  warn: () => (en()
    ? ["From this version the app is the wallet: it keeps a signing key on this phone, instead of using MetaMask.",
       "This is the maintainer's own experimental wallet. Its risk is higher than signing in an external wallet: whoever can unlock this phone and pass its fingerprint or PIN can sign with the key, within the permissions you give it on the UP.",
       "Use it only if you understand how a Universal Profile's controllers and permissions work, with small amounts, at your own risk. Free software under the MIT license, with no warranty.",
       "The key never leaves the phone and has no copy: if you lose the phone or uninstall the app, revoke it from another controller of the UP (site, Backup page)."]
    : ["Da questa versione l'app è il wallet: tiene una chiave di firma su questo telefono, invece di usare MetaMask.",
       "È il wallet sperimentale del manutentore. Il rischio è più alto che firmare in un wallet esterno: chi riesce a sbloccare questo telefono e a passare l'impronta o il PIN può firmare con la chiave, nei limiti dei permessi che le dai sulla UP.",
       "Usalo solo se sai come funzionano i controller e i permessi di una Universal Profile, con importi piccoli, a tuo rischio. Software libero con licenza MIT, senza garanzie.",
       "La chiave non esce mai dal telefono e non ha copie: se perdi il telefono o disinstalli l'app, revocala da un altro controller della UP (sito, pagina Backup)."]),
  warnOk: () => (en() ? "I understand, continue" : "Ho capito, continua"),
};

// ---- the page's networks (its own list, LUKSO first, then chains.js)
function allNets() {
  if (typeof NETWORKS !== "undefined") return NETWORKS;
  return [...(typeof LUKSO_CHAIN !== "undefined" ? [LUKSO_CHAIN] : []), ...(typeof CHAINS !== "undefined" ? CHAINS : [])];
}
// The network chosen in the page, from its list: the phone key is always on it.
function knownNet() {
  const el = $("network");
  const c = el ? allNets().find((x) => x.key === el.value) : null;
  return c && c.chainId ? c : null;
}
// A custom RPC chosen in the page: its chain id is the one the RPC reports (asked once per RPC address).
const customIds = new Map();
async function customNet() {
  const el = $("network"), r = $("customRpc");
  const rpc = el && el.value === "custom" && r ? r.value.trim() : "";
  if (!/^https?:\/\/\S+$/.test(rpc)) return null;
  if (!customIds.has(rpc)) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000);
    try {
      const res = await fetch(rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }), signal: ctl.signal });
      const j = await res.json();
      const id = Number(BigInt(j.result));
      if (!(id > 0)) return null;
      customIds.set(rpc, id);
    } catch (e) { return null; } finally { clearTimeout(timer); }
  }
  return { key: "custom", name: en() ? "custom RPC" : "RPC personalizzato", chainId: customIds.get(rpc), rpc, currency: "" };
}
async function currentNet() { return knownNet() || customNet(); }
const rpcs = new Map();
function rpcFor(net) {
  const k = `${net.chainId}|${net.rpc}`;
  if (!rpcs.has(k)) rpcs.set(k, new ethers.JsonRpcProvider(net.rpc, net.chainId, { staticNetwork: true, batchMaxCount: 1 }));
  return rpcs.get(k);
}

// ---- errors as EIP-1193 expects them
const rpcError = (code, message) => Object.assign(new Error(message), { code });
function fromNative(e) {
  const c = e && e.code;
  if (c === "CANCELED") return rpcError(4001, "User rejected the request.");
  if (c === "NO_AUTH") return rpcError(4100, T.noAuth());
  if (c === "INVALIDATED") return rpcError(4100, T.invalidated());
  if (c === "NO_KEY") return rpcError(4100, T.none());
  return rpcError(-32603, (e && e.message) || "phone key error");
}

// ---- the key
let address = null, lastStatus = null;
async function status() {
  if (!PK) return { exists: false };
  const s = await PK.status();
  address = s.exists && s.address ? ethers.getAddress(s.address) : null;
  lastStatus = s;
  return s;
}
async function ensureKey() {
  const s = await status();
  if (s.exists) return address;
  if (!PK) throw rpcError(4100, "PhoneKey not available");
  await acknowledged();
  if (!s.canAuth) throw rpcError(4100, T.noAuth());
  diag("PhoneKey: create");
  try { await PK.create({ title: "UP Wallet", subtitle: T.promptCreate(), description: T.promptDesc(), cancel: T.cancel() }); }
  catch (e) { throw fromNative(e); }
  await status();
  emit("accountsChanged", address ? [address] : []);
  renderPanel();
  return address;
}
async function signDigest(digest, subtitle, detail) {
  if (!address) await status();
  if (!address) throw rpcError(4100, T.none());
  const t0 = Date.now();
  try {
    // The fingerprint prompt says what is signed, from the signed data itself (AUDIT 2026-10-26 PK-4).
    const r = await PK.sign({ digest, title: "UP Wallet", subtitle, description: detail || T.promptDesc(), cancel: T.cancel() });
    diag(`PhoneKey: signed (${Math.round((Date.now() - t0) / 1000)} s)`);
    return r.signature;
  } catch (e) {
    diag(`PhoneKey: ${e && e.code ? e.code : "error"}`);
    throw fromNative(e);
  }
}
const sameAddr = (a) => typeof a === "string" && ethers.isAddress(a) && address && ethers.getAddress(a) === address;

// ---- what is signed
function messageBytes(m) { return typeof m === "string" && ethers.isHexString(m) ? ethers.getBytes(m) : ethers.toUtf8Bytes(String(m)); }
// One line of untrusted text for the fingerprint prompt: no control characters, clipped.
const oneLine = (t, n) => { const c = String(t).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]+/g, " ").trim(); return c.length > n ? c.slice(0, n - 1) + "…" : c; };
function messagePreview(bytes) {
  try {
    const txt = ethers.toUtf8String(bytes);
    if (!/[\u0000-\u0008\u000e-\u001f]/.test(txt)) return `"${oneLine(txt, 220)}"`;
  } catch (e) { /* not UTF-8 */ }
  const h = ethers.hexlify(bytes);
  return T.msgBytes(bytes.length, h.length > 24 ? `${h.slice(0, 12)}…${h.slice(-8)}` : h);
}
async function personalSign(params) {
  const [m, a] = params || [];
  // Some dApps send (address, message): accept either order, never another account.
  const msg = sameAddr(m) && !sameAddr(a) ? a : m, who = sameAddr(m) && !sameAddr(a) ? m : a;
  if (!sameAddr(who)) throw rpcError(4100, "not the phone key's account");
  const bytes = messageBytes(msg);
  // A 32-byte message may be an operation hash: signed, it authorizes an operation of the UP wherever the phone
  // key has the 4337 permission (AUDIT 2026-10-02 H-2). The page refuses it too; this is the key's own guard
  // (AUDIT 2026-10-26 PK-2). The page's gas relay signs operations with upwallet_signUserOperation instead.
  if (bytes.length === 32) throw rpcError(4100, T.opaque32());
  return signDigest(ethers.hashMessage(bytes), T.signMsg(), messagePreview(bytes));
}

// ---- an ERC-4337 operation of the UP (the site relayer pays the gas): the hash is computed here, from the
// operation, as EntryPoint v0.6 does, so the key signs a known operation and never an opaque 32 bytes.
const ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const UP_IFACE = new ethers.Interface(["function execute(uint256,address,uint256,bytes)", "function executeBatch(uint256[],address[],uint256[],bytes[])"]);
function userOpHash(op, chainId) {
  const enc = (t, v) => ethers.AbiCoder.defaultAbiCoder().encode(t, v);
  const packed = enc(
    ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
    [op.sender, op.nonce, ethers.keccak256(op.initCode), ethers.keccak256(op.callData), op.callGasLimit,
      op.verificationGasLimit, op.preVerificationGas, op.maxFeePerGas, op.maxPriorityFeePerGas, ethers.keccak256(op.paymasterAndData)]);
  return ethers.keccak256(enc(["bytes32", "address", "uint256"], [ethers.keccak256(packed), ENTRY_POINT, chainId]));
}
// What the UP does, from its execute / executeBatch call data (a gas-relay operation, or the payload of the
// Key Manager's execute(bytes)), for the fingerprint prompt.
function upWhat(callData, net) {
  let what;
  try {
    const d = UP_IFACE.parseTransaction({ data: callData });
    if (d.name === "execute") {
      const [, to, value, data] = d.args;
      const v = value > 0n ? `${ethers.formatEther(value)} ${net.currency || ""}`.trim() : "";
      what = T.opCall(short(to), v, ethers.dataLength(data) >= 4 ? ethers.dataSlice(data, 0, 4) : "");
    } else what = T.opBatch(d.args[1].length);
  } catch (e) { what = T.opOther(ethers.dataLength(callData) >= 4 ? ethers.dataSlice(callData, 0, 4) : "0x"); }
  return what;
}
function opSummary(op, net) { return T.opWhat(short(op.sender), upWhat(op.callData, net)); }
const KM_IFACE = new ethers.Interface(["function execute(bytes)"]);
async function signUserOperation(params) {
  const { op: raw, entryPoint, chainId } = (params || [])[0] || {};
  const net = await currentNet();
  if (!net) throw rpcError(4100, T.noSite());
  if (!raw || typeof raw !== "object") throw rpcError(-32602, T.badOp("no operation"));
  if (!entryPoint || !ethers.isAddress(entryPoint) || ethers.getAddress(entryPoint) !== ENTRY_POINT) throw rpcError(-32602, T.badOp("not EntryPoint v0.6"));
  if (Number(chainId) !== net.chainId) throw rpcError(4901, T.badOp(`chain ${Number(chainId)}, the page is on ${net.chainId}`));
  const hex = (v) => { if (!ethers.isHexString(v)) throw rpcError(-32602, T.badOp("malformed bytes")); return v; };
  const op = {
    sender: ethers.getAddress(raw.sender), nonce: BigInt(raw.nonce), initCode: hex(raw.initCode), callData: hex(raw.callData),
    callGasLimit: BigInt(raw.callGasLimit), verificationGasLimit: BigInt(raw.verificationGasLimit), preVerificationGas: BigInt(raw.preVerificationGas),
    maxFeePerGas: BigInt(raw.maxFeePerGas), maxPriorityFeePerGas: BigInt(raw.maxPriorityFeePerGas), paymasterAndData: hex(raw.paymasterAndData),
  };
  // The operation must be for the UP chosen in the page.
  const upEl = $("upAddress");
  const up = upEl && ethers.isAddress(upEl.value.trim()) ? ethers.getAddress(upEl.value.trim()) : null;
  if (!up || op.sender !== up) throw rpcError(4100, T.badOp("not the UP chosen in the page"));
  const hash = userOpHash(op, net.chainId);
  // Extension4337 checks a personal_sign of the operation hash.
  return signDigest(ethers.hashMessage(ethers.getBytes(hash)), T.signOp(net.name), opSummary(op, net));
}
async function signTyped(params) {
  const [a, data] = params || [];
  if (!sameAddr(a)) throw rpcError(4100, "not the phone key's account");
  const j = typeof data === "string" ? JSON.parse(data) : data;
  const types = { ...(j.types || {}) };
  delete types.EIP712Domain;
  const digest = ethers.TypedDataEncoder.hash(j.domain || {}, types, j.message || {});
  const dom = j.domain || {};
  return signDigest(digest, T.signTyped(String(j.primaryType || "").replace(/[^\w]/g, "").slice(0, 40) || "EIP-712"),
    T.typedDomain(oneLine(dom.name || "", 60), dom.chainId != null && /^(0x[0-9a-f]+|\d+)$/i.test(String(dom.chainId)) ? BigInt(dom.chainId).toString() : "", dom.verifyingContract && ethers.isAddress(dom.verifyingContract) ? short(ethers.getAddress(dom.verifyingContract)) : "") || undefined);
}
const big = (v) => (v === undefined || v === null || v === "" ? null : BigInt(v));
async function sendTransaction(params) {
  const tx = (params || [])[0] || {};
  const net = await currentNet();
  if (!net) throw rpcError(4100, T.noSite());
  if (tx.from && !sameAddr(tx.from)) throw rpcError(4100, "not the phone key's account");
  if (tx.chainId != null && Number(big(tx.chainId)) !== net.chainId) throw rpcError(4901, `the transaction is for chain ${Number(big(tx.chainId))}, the page is on ${net.chainId}`);
  const rpc = rpcFor(net);
  const base = { to: tx.to ? ethers.getAddress(tx.to) : null, data: tx.data || tx.input || "0x", value: big(tx.value) || 0n };
  const nonce = big(tx.nonce) !== null ? Number(big(tx.nonce)) : await rpc.getTransactionCount(address, "pending");
  const gasLimit = big(tx.gas) || big(tx.gasLimit) || await rpc.estimateGas({ ...base, from: address });
  let fees;
  if (big(tx.maxFeePerGas) !== null) fees = { type: 2, maxFeePerGas: big(tx.maxFeePerGas), maxPriorityFeePerGas: big(tx.maxPriorityFeePerGas) ?? 0n };
  else if (big(tx.gasPrice) !== null) fees = { type: 0, gasPrice: big(tx.gasPrice) };
  else {
    const f = await rpc.getFeeData();
    fees = f.maxFeePerGas != null ? { type: 2, maxFeePerGas: f.maxFeePerGas, maxPriorityFeePerGas: f.maxPriorityFeePerGas ?? 0n } : { type: 0, gasPrice: f.gasPrice };
  }
  const t = ethers.Transaction.from({ ...base, nonce, gasLimit, chainId: net.chainId, ...fees });
  const value = base.value > 0n ? `${ethers.formatEther(base.value)} ${net.currency || ""}`.trim() : "";
  // A transaction to the UP's Key Manager: the prompt says what the UP does (execute(bytes): its execute or
  // executeBatch inside), not only the Key Manager's function.
  let detail = T.txData(ethers.dataLength(base.data) ? ethers.dataSlice(base.data, 0, Math.min(4, ethers.dataLength(base.data))) : "");
  try {
    const [payload] = KM_IFACE.decodeFunctionData("execute", base.data);
    detail = T.txKm(upWhat(payload, net));
  } catch (e) { /* not the Key Manager's execute(bytes) */ }
  const sig = await signDigest(t.unsignedHash, T.signTx(net.name, base.to ? short(base.to) : "—", value), detail);
  t.signature = ethers.Signature.from(sig);
  if (ethers.getAddress(t.from) !== address) throw rpcError(-32603, "signature check failed");
  return rpc.send("eth_sendRawTransaction", [t.serialized]);
}

// ---- the EIP-1193 provider
const READS = new Set(["eth_blockNumber", "eth_call", "eth_estimateGas", "eth_feeHistory", "eth_gasPrice", "eth_getBalance",
  "eth_getBlockByHash", "eth_getBlockByNumber", "eth_getCode", "eth_getLogs", "eth_getStorageAt", "eth_getTransactionByHash",
  "eth_getTransactionCount", "eth_getTransactionReceipt", "eth_maxPriorityFeePerGas"]);
const handlers = {};
function emit(ev, arg) { for (const fn of handlers[ev] || []) { try { fn(arg); } catch (e) { /* a listener's own error */ } } }
const provider = {
  isUpWalletApp: true,
  isPhoneKey: true,
  async request(args) {
    const m = args && args.method, p = args && args.params;
    switch (m) {
      case "eth_requestAccounts": return [await ensureKey()];
      case "eth_accounts": await status(); return address ? [address] : [];
      case "eth_chainId": { const n = await currentNet(); return n ? "0x" + n.chainId.toString(16) : "0x1"; }
      case "net_version": { const n = await currentNet(); return String(n ? n.chainId : 1); }
      // The phone key follows the network chosen in the page: a network the page knows is "switched to".
      case "wallet_switchEthereumChain": {
        const id = Number(BigInt(p && p[0] && p[0].chainId));
        const n = await currentNet();
        if (n && n.chainId === id) return null;
        throw rpcError(4902, "choose this network in the page");
      }
      case "wallet_addEthereumChain": return null;
      case "personal_sign": diag("PhoneKey → personal_sign"); return personalSign(p);
      case "eth_signTypedData_v4": case "eth_signTypedData": diag(`PhoneKey → ${m}`); return signTyped(p);
      case "eth_sendTransaction": diag("PhoneKey → eth_sendTransaction"); return sendTransaction(p);
      case "upwallet_signUserOperation": diag("PhoneKey → signUserOperation"); return signUserOperation(p);
      case "eth_sign": case "eth_signTransaction": throw rpcError(4200, `${m} is not supported`);
      default: {
        // Only reads go to the network's RPC (AUDIT 2026-10-26, Info): anything else is not a wallet method.
        if (!READS.has(m)) throw rpcError(4200, `${m} is not supported`);
        const n = await currentNet();
        if (!n) throw rpcError(4100, T.noSite());
        return rpcFor(n).send(m, p || []);
      }
    }
  },
  on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return provider; },
  removeListener(ev, fn) { handlers[ev] = (handlers[ev] || []).filter((f) => f !== fn); return provider; },
};

// ---- the warning, until accepted
function isAcked() { try { return localStorage.getItem(ACK_KEY) === ACK_VERSION; } catch (e) { return false; } }
let ackWaiters = [];
function acknowledged() {
  if (isAcked()) return Promise.resolve();
  showWarning();
  return new Promise((ok) => ackWaiters.push(ok));
}
function showWarning() {
  if ($("pkWarn")) return;
  const back = document.createElement("div");
  back.id = "pkWarn";
  back.style.cssText = "position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;";
  const box = document.createElement("div");
  box.style.cssText = "max-width:520px;max-height:90vh;overflow:auto;background:var(--raised,#fff);color:var(--text,#111);border-radius:12px;padding:18px;font-size:14px;line-height:1.5;";
  const h = document.createElement("h3"); h.textContent = "⚠️ " + T.warnTitle(); h.style.marginTop = "0";
  box.appendChild(h);
  for (const p of T.warn()) { const d = document.createElement("p"); d.textContent = p; box.appendChild(d); }
  const ok = document.createElement("button");
  ok.type = "button"; ok.id = "pkWarnOk"; ok.textContent = T.warnOk();
  ok.addEventListener("click", () => {
    try { localStorage.setItem(ACK_KEY, ACK_VERSION); } catch (e) { /* asked again next time */ }
    back.remove();
    const w = ackWaiters; ackWaiters = []; for (const f of w) f();
  });
  box.appendChild(ok);
  back.appendChild(box);
  document.body.appendChild(back);
}

// ---- "This phone", under the page's connect button
// The key's name on the UP, on the page's network (kept on the UP by the Backup page, backup-check.js), and the
// key's own balance there (what it pays gas with when it sends a transaction itself), with the transfer of it
// to the page's UP: the recipient is always that UP, the amount the balance minus the transfer's maximum fee;
// the fingerprint prompt shows both, as for every transaction. A failed read is not tried again until the
// network, the UP or the key changes (renderPanel would loop).
let keyName = { k: "", name: null }, keyBal = { k: "", wei: null }, loading = {}, sweepNote = "";
function upOf() { const el = $("upAddress"); return el && ethers.isAddress(el.value.trim()) ? ethers.getAddress(el.value.trim()) : null; }
async function refreshName(n, up, k) {
  if (loading.name === k) return;
  loading.name = k;
  try { const names = await window.BackupCheck.readNames(rpcFor(n), up, [address]); keyName = { k, name: names[address.toLowerCase()] || null }; }
  catch (e) { keyName = { k, name: null, err: true }; } finally { loading.name = ""; }
  renderPanel();
}
async function refreshBal(n, k) {
  if (loading.bal === k) return;
  loading.bal = k;
  try { keyBal = { k, wei: await rpcFor(n).getBalance(address) }; } catch (e) { keyBal = { k, wei: null }; } finally { loading.bal = ""; }
  renderPanel();
}
async function sweep() {
  const n = knownNet(), up = upOf();
  if (!n || !up) { sweepNote = T.sweepNoUp(); renderPanel(); return; }
  const rpc = rpcFor(n);
  const [bal, f, gas] = await Promise.all([rpc.getBalance(address), rpc.getFeeData(), rpc.estimateGas({ from: address, to: up, value: 1n })]);
  const gasLimit = (gas * 12n) / 10n;   // the UP's receive() does a little more than a plain transfer
  const fees = f.maxFeePerGas != null
    ? { maxFeePerGas: (f.maxFeePerGas * 12n) / 10n, maxPriorityFeePerGas: f.maxPriorityFeePerGas ?? 0n }
    : { gasPrice: (f.gasPrice * 12n) / 10n };
  const value = bal - gasLimit * (fees.maxFeePerGas ?? fees.gasPrice);
  if (value <= 0n) { sweepNote = T.sweepLow(); renderPanel(); return; }
  const hex = (v) => "0x" + v.toString(16);
  const tx = { from: address, to: up, value: hex(value), gas: hex(gasLimit), chainId: hex(BigInt(n.chainId)) };
  if (fees.maxFeePerGas != null) { tx.maxFeePerGas = hex(fees.maxFeePerGas); tx.maxPriorityFeePerGas = hex(fees.maxPriorityFeePerGas); } else tx.gasPrice = hex(fees.gasPrice);
  try { sweepNote = T.sweepSent(await sendTransaction([tx])); } catch (e) { sweepNote = e.message || String(e); }
  keyBal = { k: "", wei: null };
  renderPanel();
}
function backupLink() {
  const q = new URLSearchParams();
  if (address) { q.set("phone", address); q.set("device", "phone"); }
  const up = $("upAddress") && $("upAddress").value.trim();
  if (up && ethers.isAddress(up)) q.set("up", ethers.getAddress(up));
  const n = knownNet();
  if (n) q.set("network", n.key);
  return `${SITE}up-backup.html?${q}`;
}
function renderPanel() {
  const signer = $("connectSigner");
  if (!signer) return;
  signer.textContent = T.connect();
  let box = $("pkPanel");
  if (!box) {
    box = document.createElement("div");
    box.id = "pkPanel"; box.className = "note"; box.style.marginTop = "8px";
    signer.insertAdjacentElement("afterend", box);
  }
  box.textContent = "";
  const add = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; box.appendChild(e); return e; };
  add("b", T.title());
  if (!address) { add("div", T.none()); return; }
  add("div", T.addr(address, lastStatus && lastStatus.hardware)).style.cssText = "font-family:monospace;overflow-wrap:anywhere;margin:4px 0;";
  const n = knownNet(), up = upOf();
  if (n && up && window.BackupCheck) {
    const k = `${n.chainId}:${up}:${address}`;
    if (keyName.k !== k) refreshName(n, up, k);
    else if (!keyName.err) add("div", keyName.name ? T.named(keyName.name, n.name) : T.unnamed(n.name)).style.cssText = keyName.name ? "font-weight:600;overflow-wrap:anywhere;margin:4px 0;" : "margin:4px 0;";
  }
  const bk = n ? `${n.chainId}:${address}` : "";
  const bal = bk && keyBal.k === bk ? keyBal.wei : null;
  if (bk && keyBal.k !== bk) refreshBal(n, bk);
  else if (bal !== null) add("div", T.bal(`${ethers.formatEther(bal)} ${n.currency || ""}`.trim(), n.name)).style.cssText = "margin:4px 0;";
  if (sweepNote) add("div", sweepNote).style.cssText = "margin:4px 0;overflow-wrap:anywhere;";
  add("div", T.authHint());
  const row = add("div"); row.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;";
  const btn = (text, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "secondary small"; b.textContent = text; b.addEventListener("click", fn); row.appendChild(b); return b; };
  const copy = btn(T.copy(), async () => {
    try { await navigator.clipboard.writeText(address); } catch (e) { /* the address is on screen */ }
    copy.textContent = T.copied(); setTimeout(() => { copy.textContent = T.copy(); }, 1500);
  });
  btn(T.qr(), () => {
    let q = $("pkQr");
    if (q) { q.remove(); return; }
    if (typeof qrcode !== "function") return;
    q = document.createElement("div"); q.id = "pkQr"; q.style.cssText = "max-width:220px;margin-top:8px;background:#fff;padding:6px;border-radius:8px;";
    const g = qrcode(0, "M"); g.addData(address); g.make();
    q.innerHTML = g.createSvgTag({ cellSize: 4, margin: 2, scalable: true });   // generated by the library from a checked address
    box.appendChild(q);
  });
  const link = document.createElement("a");
  link.href = backupLink(); link.target = "_blank"; link.rel = "noopener"; link.textContent = T.open();
  link.className = "secondary small"; link.style.alignSelf = "center";
  link.addEventListener("click", () => { link.href = backupLink(); });
  row.appendChild(link);
  if (bal !== null && bal > 0n) {
    const b = btn(T.sweep(), async () => { b.disabled = true; sweepNote = ""; try { await sweep(); } catch (e) { sweepNote = e.message || String(e); renderPanel(); } });
  }
  btn(T.remove(), async () => {
    if (!window.confirm(T.removeAsk())) return;
    diag("PhoneKey: remove");
    try { await PK.remove(); } catch (e) { /* gone anyway */ }
    await status();
    emit("accountsChanged", []);
    renderPanel();
  });
}
async function refresh() {
  try { lastStatus = await status(); } catch (e) { lastStatus = null; }
  renderPanel();
}

document.addEventListener("DOMContentLoaded", async () => {
  await refresh();
  // At every opening the phone key comes back by itself, with the last UP and the network: connecting it only
  // reads its address (no fingerprint). Not before the warning is accepted.
  /* global signerAddress */
  if (address && isAcked() && !(typeof signerAddress !== "undefined" && signerAddress)) { const b = $("connectSigner"); if (b) b.click(); }
  new MutationObserver(() => renderPanel()).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  // A network chosen in the page is the phone key's network: the page re-runs its check.
  const el = $("network");
  const changed = async () => { const n = await currentNet(); if (n) emit("chainChanged", "0x" + n.chainId.toString(16)); };
  if (el) el.addEventListener("change", changed);
  const rpcEl = $("customRpc");
  if (rpcEl) rpcEl.addEventListener("change", changed);
  // The name and the balance follow the network and the UP, and are read again when the app comes back to
  // the front (after the Backup page, or a transfer).
  let later = null;
  const again = (changedSetup) => { clearTimeout(later); later = setTimeout(() => { keyName = { k: "", name: null }; keyBal = { k: "", wei: null }; if (changedSetup) sweepNote = ""; renderPanel(); }, 600); };
  if (el) el.addEventListener("change", () => again(true));
  const upEl = $("upAddress");
  if (upEl) upEl.addEventListener("input", () => again(true));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") again(false); });
  if (!isAcked()) showWarning();
});

const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: INFO, provider }) }));
window.addEventListener("eip6963:requestProvider", announce);
announce();
