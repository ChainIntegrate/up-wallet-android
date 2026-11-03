// UP Wallet app (from 0.10.0): the signing window, as in the browser extension. It runs in SignerActivity's own
// WebView, which loads only these local files (no network, no dApp, no WalletConnect) and is the only place
// with the SignerBridge: the wallet page sends a structured request (a message, typed data, a transaction or
// an operation of the UP), never a digest. Here what is signed is computed again from the request itself
// (sign-plan.js, the same file as the extension's) and shown; "Sign" asks the native code for the
// fingerprint or PIN and the signature of that digest, and the answer goes back to the page.
//
// SignerBridge (SignerActivity.java):
//   request()            → JSON { request, address, lang }: the page's request, the phone key's own address
//                          (from the app's storage, not from the page) and the page's language
//   sign(digest, title)  → asynchronous: window.__upwSigned(signature) or window.__upwFailed(code, message)
//   done(result)         → the answer (JSON) to the page; the window closes
//   reject(code, message) → the refusal to the page; the window closes
// Bundled by scripts/build-web.js (esbuild) into android/app/src/main/assets/signer/signer.js.
import { ethers } from "ethers";
import { plan } from "../sign-plan.js";

window.UpwSignPlan = { plan };   // tests: the same plan the window uses

const B = window.SignerBridge;
const $ = (id) => document.getElementById(id);
let lang = "en";
const L = (it, eng) => (lang === "it" ? it : eng);
// The buttons answer only a moment after the request is shown, as in the extension: a tap meant for the page's
// own button must not press "Sign" here before the request can be read.
const ARM_MS = 1000;
let answered = false;

function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
function showError(m) { const box = $("err"); box.hidden = false; box.textContent = m; }
function busy(on) { for (const b of document.querySelectorAll("button")) b.disabled = on; }
function reject(code, message) {
  if (answered) return;
  answered = true;
  B.reject(String(code), String(message || ""));
}

function main() {
  let msg;
  try { msg = JSON.parse(B.request()); } catch (e) { reject(-32602, "no request"); return; }
  lang = msg && msg.lang === "it" ? "it" : "en";
  document.documentElement.lang = lang;
  const req = msg && msg.request;
  if (!req || !msg.address || !ethers.isAddress(msg.address)) { reject(4100, L("Nessuna chiave del telefono.", "No phone key.")); return; }
  let p;
  try { p = plan(req, msg.address, lang); } catch (e) { reject(e && e.code ? e.code : -32602, e && e.message ? e.message : String(e)); return; }
  $("title").textContent = p.title;
  if (p.site) $("site").textContent = L(`Richiesta da: ${p.site}`, `Requested by: ${p.site}`);
  for (const [label, value] of p.rows) { const r = el("div", undefined, "row"); r.append(el("div", label, "label"), el("div", value, "value")); $("rows").appendChild(r); }
  $("account").textContent = L(`Chiave del telefono: ${ethers.getAddress(msg.address)}`, `Phone key: ${ethers.getAddress(msg.address)}`);
  $("sign").textContent = L("Firma", "Sign");
  $("cancel").textContent = L("Rifiuta", "Reject");
  $("cancel").onclick = () => reject(4001, "User rejected the request.");
  $("sign").onclick = () => {
    busy(true); $("err").hidden = true;
    window.__upwSigned = (sigHex) => {
      try {
        const result = p.finish(ethers.Signature.from(sigHex));
        answered = true;
        B.done(JSON.stringify(result));
      } catch (e) { busy(false); showError(e && e.message ? e.message : String(e)); }
    };
    window.__upwFailed = (code, message) => {
      // The fingerprint prompt closed by the user: back to the window, which can sign again or reject.
      if (code === "CANCELED") { busy(false); return; }
      if (code === "NO_AUTH" || code === "INVALIDATED" || code === "NO_KEY") { reject(code, message); return; }
      busy(false); showError(message || code);
    };
    B.sign(p.digest, p.title);
  };
  busy(true);
  $("actions").hidden = false;
  setTimeout(() => { if (!answered) busy(false); }, ARM_MS);
}

if (B) main();
