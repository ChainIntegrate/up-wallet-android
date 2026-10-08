// UP Wallet app: what the phone adds around the page, without changing it.
// - "Paste" next to the WalletConnect link field (the system clipboard, through Capacitor).
// - A wc: link that another app opens with UP Wallet, or text shared to it (Share -> UP Wallet): the
//   link is put in the field, ready; connecting still takes the user's tap on the page's button.
// - The UP address and the network are remembered on this phone and filled in at the next start.
// - Calls to the site's relay service go through Android's HTTP stack (CapacitorHttp), not the web
//   view's fetch: the app's origin (https://upwallet.chainintegrate.it) is not the site's, and the browser's cross-origin
//   rules would block them. The relay checks UP, controller, limits and paymaster as for the site.
// - A request from a dApp that arrives while UP Wallet is in the background shows a notification: a tap
//   brings UP Wallet to the front (Android does not let an app bring itself to the front).
// - Once the dApp has its answer (signature sent, operation done, simulation, rejection, session
//   active), a "Back to the dApp" button brings the default browser back to the front, on the tab it
//   was showing (or, without a default browser, puts UP Wallet in the background).
// - While a dApp is connected the app stays running (a foreground service with an ongoing notification):
//   otherwise Android freezes it after a few minutes in the background and requests wait for the user.
// - Panel 3 suggests MetaMask's auto-lock at 5 minutes: when MetaMask locks while a request is open, it
//   drops the request (the page gets "User rejected").
// Bundled by scripts/build-web.js (esbuild) into www/app/native.js.
import { Clipboard } from "@capacitor/clipboard";
import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { App } from "@capacitor/app";

const IncomingLink = registerPlugin("IncomingLink");
const KeepAlive = registerPlugin("KeepAlive");

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

// ---- notifications and the way back to the dApp ----
const native = () => Capacitor.isNativePlatform();
const diag = (t) => { if (window.upwDiag) window.upwDiag.add(t); };
const N = {
  sign: () => (en() ? "a signature" : "una firma"),
  tx: () => (en() ? "a transaction" : "una transazione"),
  connect: () => (en() ? "to connect" : "di collegarsi"),
  body: (who, what) => (en() ? `${who} asks for ${what}: tap to open UP Wallet.` : `${who} chiede ${what}: tocca per aprire UP Wallet.`),
  back: () => (en() ? "↩ Back to the dApp" : "↩ Torna alla dApp"),
  channel: () => (en() ? "dApp requests" : "Richieste delle dApp"),
  keep: (who) => (en() ? `Connected to ${who}: UP Wallet stays active to receive its requests.` : `Collegato a ${who}: UP Wallet resta attivo per ricevere le richieste.`),
  keepChannel: () => (en() ? "Connection to dApps" : "Collegamento alle dApp"),
  lockTip: () => (en()
    ? "Tip: in MetaMask set Auto-lock to 5 minutes (Settings → Security & privacy). If MetaMask locks while you are reading a request, it cancels it and the page gets \"rejected\"."
    : "Consiglio: in MetaMask imposta il Blocco automatico a 5 minuti (Impostazioni → Sicurezza e privacy). Se MetaMask si blocca mentre leggi una richiesta, la annulla e qui risulta \"rifiutata\"."),
};
// The dApp's site as shown in the page's lines ("Name (https://site)"): its host, short and verified.
const hostOf = (url) => { try { return new URL(url).host.replace(/^www\./, ""); } catch (e) { return ""; } };
const REQ = /^(?:Richiesta dalla dApp|Request from the dApp): (\S+)/;
const PROP = /^(?:Richiesta di connessione da|Connection request from): (.+?) \((https?:\/\/[^)\s]+)\)/;
const SESSION = /(?:Sessione attiva con|Session active with) (.+?) \((https?:\/\/[^)\s]+)\)/;
const DONE = /Firma inviata alla dApp|Signature sent to the dApp|Operazione eseguita|Operation done|Transazione confermata|Transaction confirmed|Modalità simulazione: niente inviato|Simulation mode: nothing sent|^Richiesta rifiutata|^Request rejected|^❌/;
let dappName = "", notifId = 1;

async function notify(what) {
  if (!document.hidden) return;
  const n = { id: notifId++, title: "UP Wallet", body: N.body(dappName || "dApp", what), channelId: "requests" };
  diag((en() ? "Notification: " : "Notifica: ") + n.body);
  if (window.__upwalletNotify) return window.__upwalletNotify(n);   // tests
  if (!native()) return;
  try { await LocalNotifications.schedule({ notifications: [n] }); } catch (e) { diag("Notification failed: " + (e && e.message)); }
}
async function askPermission() {
  if (!native()) return;
  try {
    const p = await LocalNotifications.checkPermissions();
    if (p.display === "prompt" || p.display === "prompt-with-rationale") await LocalNotifications.requestPermissions();
  } catch (e) { /* no notifications: the app works without them */ }
}

// Keeps the app running while a dApp is connected; stops when no session is left.
let keptFor = null;
function keepAlive(who) {
  if (who === keptFor) return;
  keptFor = who;
  diag(who ? `Keep-alive: on (${who})` : "Keep-alive: off");
  const k = window.__upwalletKeepAlive || (native() ? KeepAlive : null);   // __upwalletKeepAlive: tests
  if (!k) return;
  (who ? k.start({ text: N.keep(who), channel: N.keepChannel() }) : k.stop()).catch?.((e) => diag("Keep-alive failed: " + (e && e.message)));
}

let backBtn = null, backTimer = null;
function showBack(on) {
  if (!backBtn) return;
  clearTimeout(backTimer);
  backBtn.hidden = !on;
  if (on) backTimer = setTimeout(() => { backBtn.hidden = true; }, 30000);
}
function addBackButton() {
  backBtn = document.createElement("button");
  backBtn.id = "backToDapp";
  backBtn.type = "button";
  backBtn.hidden = true;
  backBtn.textContent = N.back();
  backBtn.style.cssText = "position:fixed; right:12px; bottom:12px; z-index:80; width:auto; padding:12px 16px; border-radius:24px; box-shadow:0 4px 16px rgba(0,0,0,0.4);";
  backBtn.addEventListener("click", () => {
    showBack(false);
    diag(en() ? "Back to the dApp." : "Torna alla dApp.");
    if (window.__upwalletMinimize) return window.__upwalletMinimize();   // tests
    if (!native()) return;
    // The browser's own task, on the tab it was showing; without a default browser, just the background.
    IncomingLink.backToBrowser().then((r) => {
      diag(r && r.ok ? `→ ${r.browser}` : "→ background");
      if (!r || !r.ok) return App.minimizeApp();
    }).catch(() => App.minimizeApp().catch(() => null));
  });
  document.body.appendChild(backBtn);
}

function watchPage() {
  const onLine = (t) => {
    let m;
    if ((m = t.match(PROP))) { dappName = hostOf(m[2]) || m[1]; showBack(false); notify(N.connect()); }
    else if ((m = t.match(REQ))) { showBack(false); notify(/sendTransaction/.test(m[1]) ? N.tx() : N.sign()); }
    else if (DONE.test(t)) showBack(true);
  };
  const log = $("log");
  if (log) new MutationObserver((muts) => { for (const mu of muts) for (const n of mu.addedNodes) onLine((n.textContent || "").trim()); }).observe(log, { childList: true });
  const st = $("wcStatus");
  if (st) new MutationObserver(() => {
    const m = (st.textContent || "").match(SESSION);
    if (m) { dappName = hostOf(m[2]) || m[1]; showBack(true); }
    keepAlive(m ? dappName : null);
  }).observe(st, { childList: true, subtree: true, characterData: true });
  const signer = $("connectSigner");
  if (signer && !$("mmLockTip")) {
    const tip = document.createElement("div");
    tip.id = "mmLockTip"; tip.className = "note"; tip.style.marginTop = "6px";
    tip.textContent = N.lockTip();
    signer.insertAdjacentElement("afterend", tip);
  }
  const pair = $("pairBtn");
  if (pair) pair.addEventListener("click", askPermission);
  if (signer) signer.addEventListener("click", askPermission);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && native()) LocalNotifications.removeAllDeliveredNotifications().catch(() => null);
  });
  if (native()) LocalNotifications.createChannel({ id: "requests", name: N.channel(), importance: 5, visibility: 1, vibration: true }).catch(() => null);
}

// The notice MetaMask Connect's license asks for in each copy of a program that uses it, under the
// page's footer (the page's own footer already carries Reown's notice for WalletConnect).
const NOTICES = "https://github.com/ChainIntegrate/up-wallet-android/blob/main/THIRD_PARTY_NOTICES.md";
function addNotice() {
  const footer = document.querySelector(".site-footer");
  if (!footer) return;
  const d = document.createElement("div");
  d.id = "appNotice";
  d.style.cssText = "font-size:11.5px; margin:10px 4px 0; color:var(--muted, #6b7280);";
  const a = document.createElement("a");
  a.href = NOTICES; a.target = "_blank"; a.rel = "noopener";
  const fill = () => {
    d.textContent = en()
      ? "UP Wallet app: uses MetaMask Connect, © ConsenSys Software Inc., under ConsenSys' license (non-commercial use or up to 10,000 monthly active users). "
      : "App UP Wallet: usa MetaMask Connect, © ConsenSys Software Inc., con la licenza di ConsenSys (uso non commerciale o fino a 10.000 utenti attivi al mese). ";
    a.textContent = en() ? "Third-party notices" : "Componenti di terzi";
    d.appendChild(a);
  };
  fill();
  footer.insertAdjacentElement("afterend", d);
  const lang = document.getElementById("langToggle");
  if (lang) lang.addEventListener("click", () => setTimeout(fill, 0));
}

document.addEventListener("DOMContentLoaded", () => {
  addNotice();
  addBackButton();
  watchPage();
  remember();
  addPasteButton();
  if (Capacitor.isNativePlatform()) {
    IncomingLink.addListener("incoming", (d) => useText(d && d.text, true));
    IncomingLink.getPending().then((r) => { if (r && r.text) useText(r.text, true); }).catch(() => null);
  }
});
