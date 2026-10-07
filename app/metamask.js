// UP Wallet app: MetaMask mobile as the page's signing wallet.
// In the app there is no browser extension, so the page finds no wallet. This file announces one
// through EIP-6963, the way the extension does: an EIP-1193 provider backed by MetaMask Connect, which
// talks to the MetaMask app on the same phone and opens it (metamask:// link) for each confirmation.
// The page uses it exactly as it uses the extension: nothing in the page changes.
// Bundled by scripts/build-web.js (esbuild) into www/app/metamask.js; loaded after chains.js.
import { createEVMClient } from "@metamask/connect-evm";
import { AppLauncher } from "@capacitor/app-launcher";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

const INFO = Object.freeze({
  uuid: "6f1c2c8e-5b1a-4d43-9a43-2c0d6b9e7a51",
  name: "MetaMask (app)",
  icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23f6851b'/%3E%3C/svg%3E",
  rdns: "it.chainintegrate.upwallet.metamask",
});

// The networks MetaMask may be asked to use: every network of chains.js, with its public RPC.
function supportedNetworks() {
  const out = {};
  for (const c of (typeof CHAINS !== "undefined" ? CHAINS : [])) {
    if (c.chainId && typeof c.rpc === "string" && c.rpc.startsWith("https://")) out["0x" + c.chainId.toString(16)] = c.rpc;
  }
  return out;
}

// The network chosen in the page (panel 1), as a hex chain id, or null.
function selectedChain() {
  const el = document.getElementById("network");
  const c = el && typeof CHAINS !== "undefined" ? CHAINS.find((x) => x.key === el.value) : null;
  return c && c.chainId ? "0x" + c.chainId.toString(16) : null;
}
// Networks asked for at connection, besides the chosen one: changing among them needs no new approval.
const MAIN_CHAINS = ["0x2105", "0x89", "0xa4b1", "0xa86a", "0x1"];   // Base, Polygon, Arbitrum, Avalanche, Ethereum

// MetaMask is opened through Android (an intent), not by navigating the app's web view.
// MetaMask Connect may ask to open the same link twice for one request (two code paths); opening it
// again made MetaMask show the same request more than once. The same link within 5 s is opened once.
let lastLink = { url: null, at: 0 };
// Each opening is noted in the page's log (prototype: to tell apart repeated requests from MetaMask).
function note(text) {
  const log = document.getElementById("log");
  if (!log) return;
  const d = document.createElement("div");
  d.className = "line-dim";
  d.textContent = `${new Date().toLocaleTimeString()} ${text}`;
  log.appendChild(d);
  diag(text);
}
function diag(text) { if (window.upwDiag) window.upwDiag.add(text); }
function openLink(url) {
  const now = Date.now();
  const what = /\/mwp\?/.test(url) ? "request" : "connection";
  const en = document.documentElement.lang === "en";
  if (url === lastLink.url && now - lastLink.at < 5000) {
    note(en ? `MetaMask (${what}): already opened, not opened again.` : `MetaMask (${what === "request" ? "richiesta" : "collegamento"}): già aperto, non riaperto.`);
    return;
  }
  lastLink = { url, at: now };
  note(en ? `MetaMask opened (${what}).` : `Apertura di MetaMask (${what === "request" ? "richiesta" : "collegamento"}).`);
  if (!Capacitor.isNativePlatform()) { (window.__upwalletOpenLink || ((u) => { window.location.href = u; }))(url); return; }   // web: tests
  AppLauncher.openUrl({ url }).then((r) => {
    if (r && r.completed === false) window.alert(document.documentElement.lang === "en"
      ? "MetaMask could not be opened. Is the MetaMask app installed on this phone?"
      : "Impossibile aprire MetaMask. L'app MetaMask è installata su questo telefono?");
  }, (e) => console.error("Cannot open MetaMask", e));
}

// The networks of the last approved connection. A connection kept by MetaMask Connect for fewer
// networks than asked now is not reused: MetaMask may no longer know it ("connection not found").
const CHAINS_KEY = "upwallet.metamask.chains";
const approvedChains = () => { try { return JSON.parse(localStorage.getItem(CHAINS_KEY)) || []; } catch (e) { return []; } };
async function dropOldConnection(want) {
  const had = approvedChains();
  if (want.every((c) => had.includes(c))) return;
  try {
    const dbs = indexedDB.databases ? await indexedDB.databases() : [];
    await Promise.all(dbs.filter((d) => d.name && d.name.startsWith("mmconnect")).map((d) => new Promise((ok) => {
      const r = indexedDB.deleteDatabase(d.name); r.onsuccess = r.onerror = r.onblocked = () => ok();
    })));
  } catch (e) { console.error("Cannot clear the old MetaMask connection", e); }
  try { localStorage.removeItem(CHAINS_KEY); } catch (e) { /* nothing stored */ }
}
const wantedChains = () => [...new Set([selectedChain(), ...MAIN_CHAINS].filter(Boolean))];

let client = null;
let starting = null;
const listeners = [];   // [event, handler] added before the client existed

function start() {
  if (!starting) {
    starting = dropOldConnection(wantedChains()).then(() => createEVMClient({
      dapp: { name: "UP Wallet (ChainIntegrate)", url: "https://crosschain-lukso.chainintegrate.it" },
      api: { supportedNetworks: supportedNetworks() },
      analytics: { enabled: false },
      mobile: { preferredOpenLink: openLink, useDeeplink: true },
      skipAutoAnnounce: true,
    })).then((c) => {
      client = c;
      const p = c.getProvider();
      for (const [ev, fn] of listeners) p.on(ev, fn);
      listeners.length = 0;
      return c;
    }, (e) => { starting = null; throw e; });
  }
  return starting;
}

let connected = false;

// With MetaMask Connect the network is chosen by the app, not in MetaMask: the connection is made
// for the chosen network (plus the main ones), and it follows the network chosen in the page.
async function follow() {
  const id = selectedChain();
  if (!client || !connected || !id) return;
  diag(`MetaMask: network ${id}`);
  try { await client.switchChain({ chainId: id }); } catch (e) { console.error("Network change refused", e); }
}

// MetaMask Connect remembers the last network used and may bring it back after connecting (when a stored
// connection is resumed, a late session message picks the remembered network, e.g. Polygon, over the one
// just asked for); the page then saw the wallet on another network. Before each request the connection is
// put back on the page's network, if it is one of the approved ones: that change is local and opens
// nothing. Other networks are asked of MetaMask only by follow() (a network chosen in the page).
async function keepChain(c) {
  const id = selectedChain();
  if (!connected || !id || c.selectedChainId === id || !approvedChains().includes(id)) return;
  diag(`MetaMask: network ${c.selectedChainId} → ${id}`);
  try { await c.switchChain({ chainId: id }); } catch (e) { console.error("Network change refused", e); }
}

async function requestInner(args) {
  const c = client || await start();
  if (args && (args.method === "eth_requestAccounts" || args.method === "wallet_requestPermissions")) {
    const chainIds = wantedChains();
    const r = await c.connect({ chainIds });
    connected = true;
    try { localStorage.setItem(CHAINS_KEY, JSON.stringify([...new Set([...approvedChains(), ...chainIds])])); } catch (e) { /* not kept */ }
    await follow();
    return args.method === "eth_requestAccounts" ? r.accounts : c.getProvider().request(args);
  }
  if (!/^eth_accounts$/.test(args && args.method)) await keepChain(c);
  return c.getProvider().request(args);
}

const provider = {
  isUpWalletApp: true,
  async request(args) {
    const m = args && args.method;
    const toWallet = m && !/^eth_(chainId|accounts)$/.test(m);
    if (!toWallet) return requestInner(args);
    const t0 = Date.now();
    diag(`MetaMask → ${m}`);
    try {
      const r = await requestInner(args);
      diag(`MetaMask ← ${m}: ok (${Math.round((Date.now() - t0) / 1000)} s)`);
      return r;
    } catch (e) {
      diag(`MetaMask ← ${m}: ${(e && (e.code != null ? e.code + " " : "") + (e.message || "")).slice(0, 100)} (${Math.round((Date.now() - t0) / 1000)} s)`);
      throw e;
    }
  },
  on(ev, fn) {
    if (client) client.getProvider().on(ev, fn); else listeners.push([ev, fn]);
    return provider;
  },
  removeListener(ev, fn) {
    if (client) client.getProvider().removeListener(ev, fn);
    else { const i = listeners.findIndex(([e, f]) => e === ev && f === fn); if (i >= 0) listeners.splice(i, 1); }
    return provider;
  },
};

// A network picked from the list goes to MetaMask at once. Typing or deleting in the network filter
// changes the choice at each letter, and a network outside the approved ones opens MetaMask to ask for
// it (seen in the tests: 0G and ApeChain while deleting "bas"): from the filter, the network goes to
// MetaMask once the choice has stayed the same for 1.5 s.
let followTimer = null;
document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("network");
  if (el) el.addEventListener("change", () => { clearTimeout(followTimer); follow(); });
  const filter = document.getElementById("networkFilter");
  if (filter) filter.addEventListener("input", () => { clearTimeout(followTimer); followTimer = setTimeout(follow, 1500); });
});

// Back in UP Wallet (from MetaMask, or anywhere else): renew the connection to MetaMask's relay, so an
// answer sent while the app was suspended is read (the build makes the focus handler renew it).
let lastRenew = 0;
function cameBack() {
  if (!client || Date.now() - lastRenew < 2000) return;
  lastRenew = Date.now();
  note(document.documentElement.lang === "en" ? "Back in the app: MetaMask connection renewed." : "Ritorno nell'app: collegamento con MetaMask rinnovato.");
  window.dispatchEvent(new Event("focus"));
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") cameBack(); });
if (Capacitor.isNativePlatform()) {
  App.addListener("resume", () => { diag("Android: resume"); cameBack(); }).catch(() => null);
  App.addListener("pause", () => diag("Android: pause")).catch(() => null);
}

const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: INFO, provider }) }));
window.addEventListener("eip6963:requestProvider", announce);
announce();
