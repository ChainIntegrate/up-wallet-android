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
    ? "To use it, authorize it once on each network where the UP exists: on a computer, the site's Backup page, \"Authorize a phone\", signed by an admin controller of the UP (for example in MetaMask). A lost phone is revoked from the same page."
    : "Per usarla, autorizzala una volta su ogni rete dove esiste la UP: dal computer, pagina Backup del sito, \"Autorizza un telefono\", firmato da un controller amministratore della UP (per esempio in MetaMask). Un telefono perso si revoca dalla stessa pagina."),
  copy: () => (en() ? "Copy address" : "Copia indirizzo"),
  copied: () => (en() ? "Copied" : "Copiato"),
  qr: () => (en() ? "Show QR" : "Mostra QR"),
  open: () => (en() ? "Open the Backup page" : "Apri la pagina Backup"),
  remove: () => (en() ? "Delete the phone key" : "Elimina la chiave del telefono"),
  removeAsk: () => (en()
    ? "Delete the phone key from this phone? It cannot be recovered. First revoke it on every network (site, Backup page), or it stays a controller of the UP that nobody can use."
    : "Eliminare la chiave del telefono? Non si può recuperare. Prima revocala su ogni rete (sito, pagina Backup), altrimenti resta un controller della UP che nessuno può usare."),
  noAuth: () => (en() ? "Set up a fingerprint or a screen lock on the phone first." : "Prima imposta un'impronta o un blocco schermo sul telefono."),
  invalidated: () => (en()
    ? "The phone key can no longer be unlocked (the screen lock was changed or removed). Delete it, create a new one, and revoke the old address from the site's Backup page."
    : "La chiave del telefono non si può più sbloccare (il blocco schermo è stato cambiato o tolto). Eliminala, creane una nuova e revoca il vecchio indirizzo dalla pagina Backup del sito."),
  promptCreate: () => (en() ? "Create the phone key" : "Crea la chiave del telefono"),
  promptDesc: () => (en() ? "The key stays on this phone, encrypted. It signs only after your confirmation." : "La chiave resta su questo telefono, cifrata. Firma solo dopo la tua conferma."),
  cancel: () => (en() ? "Cancel" : "Annulla"),
  signMsg: () => (en() ? "Sign a message" : "Firma di un messaggio"),
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
// The network chosen in the page: the phone key is always on it.
function currentNet() {
  const el = $("network");
  const c = el ? allNets().find((x) => x.key === el.value) : null;
  return c && c.chainId ? c : null;
}
const rpcs = new Map();
function rpcFor(net) {
  if (!rpcs.has(net.chainId)) rpcs.set(net.chainId, new ethers.JsonRpcProvider(net.rpc, net.chainId, { staticNetwork: true, batchMaxCount: 1 }));
  return rpcs.get(net.chainId);
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
async function signDigest(digest, subtitle) {
  if (!address) await status();
  if (!address) throw rpcError(4100, T.none());
  const t0 = Date.now();
  try {
    const r = await PK.sign({ digest, title: "UP Wallet", subtitle, description: T.promptDesc(), cancel: T.cancel() });
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
async function personalSign(params) {
  const [m, a] = params || [];
  // Some dApps send (address, message): accept either order, never another account.
  const msg = sameAddr(m) && !sameAddr(a) ? a : m, who = sameAddr(m) && !sameAddr(a) ? m : a;
  if (!sameAddr(who)) throw rpcError(4100, "not the phone key's account");
  return signDigest(ethers.hashMessage(messageBytes(msg)), T.signMsg());
}
async function signTyped(params) {
  const [a, data] = params || [];
  if (!sameAddr(a)) throw rpcError(4100, "not the phone key's account");
  const j = typeof data === "string" ? JSON.parse(data) : data;
  const types = { ...(j.types || {}) };
  delete types.EIP712Domain;
  const digest = ethers.TypedDataEncoder.hash(j.domain || {}, types, j.message || {});
  return signDigest(digest, T.signTyped(String(j.primaryType || "").replace(/[^\w]/g, "").slice(0, 40) || "EIP-712"));
}
const big = (v) => (v === undefined || v === null || v === "" ? null : BigInt(v));
async function sendTransaction(params) {
  const tx = (params || [])[0] || {};
  const net = currentNet();
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
  const sig = await signDigest(t.unsignedHash, T.signTx(net.name, base.to ? short(base.to) : "—", value));
  t.signature = ethers.Signature.from(sig);
  if (ethers.getAddress(t.from) !== address) throw rpcError(-32603, "signature check failed");
  return rpc.send("eth_sendRawTransaction", [t.serialized]);
}

// ---- the EIP-1193 provider
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
      case "eth_chainId": { const n = currentNet(); return n ? "0x" + n.chainId.toString(16) : "0x1"; }
      case "net_version": { const n = currentNet(); return String(n ? n.chainId : 1); }
      // The phone key follows the network chosen in the page: a network the page knows is "switched to".
      case "wallet_switchEthereumChain": {
        const id = Number(BigInt(p && p[0] && p[0].chainId));
        const n = currentNet();
        if (n && n.chainId === id) return null;
        throw rpcError(4902, "choose this network in the page");
      }
      case "wallet_addEthereumChain": return null;
      case "personal_sign": diag("PhoneKey → personal_sign"); return personalSign(p);
      case "eth_signTypedData_v4": case "eth_signTypedData": diag(`PhoneKey → ${m}`); return signTyped(p);
      case "eth_sendTransaction": diag("PhoneKey → eth_sendTransaction"); return sendTransaction(p);
      case "eth_sign": case "eth_signTransaction": throw rpcError(4200, `${m} is not supported`);
      default: {
        const n = currentNet();
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
function backupLink() {
  const q = new URLSearchParams();
  if (address) q.set("phone", address);
  const up = $("upAddress") && $("upAddress").value.trim();
  if (up && ethers.isAddress(up)) q.set("up", ethers.getAddress(up));
  const n = currentNet();
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

document.addEventListener("DOMContentLoaded", () => {
  refresh();
  new MutationObserver(() => renderPanel()).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  // A network chosen in the page is the phone key's network: the page re-runs its check.
  const el = $("network");
  if (el) el.addEventListener("change", () => { const n = currentNet(); if (n) emit("chainChanged", "0x" + n.chainId.toString(16)); });
  if (!isAcked()) showWarning();
});

const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: INFO, provider }) }));
window.addEventListener("eip6963:requestProvider", announce);
announce();
