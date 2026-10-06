// UP Wallet app: what the phone adds around the page, without changing it.
// - "Paste" next to the WalletConnect link field (the system clipboard, through Capacitor).
// - A wc: link that another app opens with UP Wallet, or text shared to it (Share -> UP Wallet): the
//   link is put in the field, ready; connecting still takes the user's tap on the page's button.
// - The UP address and the network are remembered on this phone and filled in at the next start.
// - Calls to the site's relay service go through Android's HTTP stack (CapacitorHttp), not the web
//   view's fetch: the app's origin (https://localhost) is not the site's, and the browser's cross-origin
//   rules would block them. The relay checks UP, controller, limits and paymaster as for the site.
// Bundled by scripts/build-web.js (esbuild) into www/app/native.js.
import { Clipboard } from "@capacitor/clipboard";
import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";

const IncomingLink = registerPlugin("IncomingLink");

// ---- relay calls ----
const SITE = window.__upwalletSite || "";
function relayUrl(input) {
  if (typeof input !== "string" || !SITE) return null;
  if (/^\.?\/?relay\//.test(input)) return SITE + input.replace(/^\.?\//, "");
  return input.startsWith(SITE + "relay/") ? input : null;
}
function headersOf(h) {
  const out = {};
  if (!h) return out;
  if (typeof Headers !== "undefined" && h instanceof Headers) h.forEach((v, k) => { out[k.toLowerCase()] = v; });
  else for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = String(v);
  return out;
}
const webFetch = window.fetch.bind(window);
window.fetch = async function (input, init) {
  const url = relayUrl(input);
  const http = window.__upwalletHttp || (Capacitor.isNativePlatform() ? (o) => CapacitorHttp.request(o) : null);   // __upwalletHttp: tests
  if (!url || !http) return webFetch(input, init);
  const headers = headersOf(init && init.headers);
  let data = init && init.body != null ? init.body : undefined;
  if (typeof data === "string" && /json/i.test(headers["content-type"] || "")) { try { data = JSON.parse(data); } catch (e) { /* sent as text */ } }
  let r;
  try { r = await http({ url, method: (init && init.method) || "GET", headers, data, responseType: "text", connectTimeout: 15000, readTimeout: 60000 }); }
  catch (e) { throw new TypeError("Failed to fetch: " + (e && e.message ? e.message : e)); }   // as fetch: a network failure rejects
  const body = r.data == null ? "" : typeof r.data === "string" ? r.data : JSON.stringify(r.data);
  try { return new Response(body, { status: r.status, headers: r.headers || {} }); }
  catch (e) { return new Response(body, { status: r.status, headers: { "content-type": "application/json" } }); }
};
const $ = (id) => document.getElementById(id);
const en = () => document.documentElement.lang === "en";
const T = {
  paste: () => (en() ? "Paste" : "Incolla"),
  noLink: () => (en() ? "No WalletConnect link (wc:...) in what was received." : "Nel testo ricevuto non c'è un link WalletConnect (wc:...)."),
  received: () => (en() ? "WalletConnect link received: check the steps above, then press Connect." : "Link WalletConnect ricevuto: controlla i passi sopra, poi premi Collega."),
};

// The first wc: link in a text: as it is, or URL-encoded inside another link (...?uri=wc%3A...).
function findLink(text) {
  const t = String(text || "");
  const plain = t.match(/wc:[^\s"'<>]+/);
  if (plain) return plain[0];
  const enc = t.match(/wc%3A[^\s"'<>&]+/i);
  if (!enc) return null;
  try { return decodeURIComponent(enc[0]); } catch (e) { return null; }
}

function useText(text, fromOutside) {
  const link = findLink(text);
  const field = $("wcUri");
  if (!field) return;
  if (!link) { if (fromOutside) window.alert(T.noLink()); return; }
  field.value = link;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  if (fromOutside) {
    field.scrollIntoView({ block: "center" });
    const box = $("wcStatus");
    if (box) { box.textContent = T.received(); box.className = "status-box line-ok"; }
  }
}

function addPasteButton() {
  const field = $("wcUri");
  if (!field || $("wcPaste")) return;
  const b = document.createElement("button");
  b.id = "wcPaste";
  b.type = "button";
  b.className = "secondary";
  b.textContent = T.paste();
  b.addEventListener("click", async () => {
    try { const r = await Clipboard.read(); useText(r && r.value, false); if (!findLink(r && r.value)) window.alert(T.noLink()); }
    catch (e) { window.alert(T.noLink()); }
  });
  field.insertAdjacentElement("afterend", b);
  new MutationObserver(() => { b.textContent = T.paste(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
}

// Remembered on this phone only (the app's own storage, not backed up).
const KEY = { up: "upwallet.up", network: "upwallet.network" };
function remember() {
  const up = $("upAddress"), net = $("network");
  try {
    const savedNet = localStorage.getItem(KEY.network);
    if (net && savedNet && [...net.options].some((o) => o.value === savedNet) && net.value !== savedNet) {
      net.value = savedNet;
      net.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const savedUp = localStorage.getItem(KEY.up);
    if (up && savedUp && !up.value) {
      up.value = savedUp;
      up.dispatchEvent(new Event("input", { bubbles: true }));
    }
  } catch (e) { /* storage unavailable: nothing remembered */ }
  if (net) net.addEventListener("change", () => { try { localStorage.setItem(KEY.network, net.value); } catch (e) { /* not kept */ } });
  if (up) up.addEventListener("input", () => {
    const v = up.value.trim();
    try { if (/^0x[0-9a-fA-F]{40}$/.test(v)) localStorage.setItem(KEY.up, v); } catch (e) { /* not kept */ }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  remember();
  addPasteButton();
  if (Capacitor.isNativePlatform()) {
    IncomingLink.addListener("incoming", (d) => useText(d && d.text, true));
    IncomingLink.getPending().then((r) => { if (r && r.text) useText(r.text, true); }).catch(() => null);
  }
});
