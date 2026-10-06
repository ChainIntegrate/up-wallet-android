// UP Wallet app: what the phone adds around the page, without changing it.
// - "Paste" next to the WalletConnect link field (the system clipboard, through Capacitor).
// - A wc: link that another app opens with UP Wallet, or text shared to it (Share -> UP Wallet): the
//   link is put in the field, ready; connecting still takes the user's tap on the page's button.
// - The UP address and the network are remembered on this phone and filled in at the next start.
// Bundled by scripts/build-web.js (esbuild) into www/app/native.js.
import { Clipboard } from "@capacitor/clipboard";
import { Capacitor, registerPlugin } from "@capacitor/core";

const IncomingLink = registerPlugin("IncomingLink");
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
