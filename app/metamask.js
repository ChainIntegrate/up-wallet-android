// UP Wallet app: MetaMask mobile as the page's signing wallet.
// In the app there is no browser extension, so the page finds no wallet. This file announces one
// through EIP-6963, the way the extension does: an EIP-1193 provider backed by MetaMask Connect, which
// talks to the MetaMask app on the same phone and opens it (metamask:// link) for each confirmation.
// The page uses it exactly as it uses the extension: nothing in the page changes.
// Bundled by scripts/build-web.js (esbuild) into www/app/metamask.js; loaded after chains.js.
import { createEVMClient } from "@metamask/connect-evm";
import { AppLauncher } from "@capacitor/app-launcher";
import { Capacitor } from "@capacitor/core";

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
function openLink(url) {
  if (!Capacitor.isNativePlatform()) { window.location.href = url; return; }
  AppLauncher.openUrl({ url }).then((r) => {
    if (r && r.completed === false) window.alert(document.documentElement.lang === "en"
      ? "MetaMask could not be opened. Is the MetaMask app installed on this phone?"
      : "Impossibile aprire MetaMask. L'app MetaMask è installata su questo telefono?");
  }, (e) => console.error("Cannot open MetaMask", e));
}

let client = null;
let starting = null;
const listeners = [];   // [event, handler] added before the client existed

function start() {
  if (!starting) {
    starting = createEVMClient({
      dapp: { name: "UP Wallet (ChainIntegrate)", url: "https://crosschain-lukso.chainintegrate.it" },
      api: { supportedNetworks: supportedNetworks() },
      analytics: { enabled: false },
      mobile: { preferredOpenLink: openLink, useDeeplink: true },
      skipAutoAnnounce: true,
    }).then((c) => {
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
  try { await client.switchChain({ chainId: id }); } catch (e) { console.error("Network change refused", e); }
}

const provider = {
  isUpWalletApp: true,
  async request(args) {
    const c = client || await start();
    if (args && (args.method === "eth_requestAccounts" || args.method === "wallet_requestPermissions")) {
      const id = selectedChain();
      const chainIds = [...new Set([id, ...MAIN_CHAINS].filter(Boolean))];
      const r = await c.connect({ chainIds });
      connected = true;
      await follow();
      return args.method === "eth_requestAccounts" ? r.accounts : c.getProvider().request(args);
    }
    return c.getProvider().request(args);
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

document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("network");
  if (el) el.addEventListener("change", follow);
  const filter = document.getElementById("networkFilter");
  if (filter) filter.addEventListener("input", () => setTimeout(follow, 0));   // the filter changes the choice too
});

const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: INFO, provider }) }));
window.addEventListener("eip6963:requestProvider", announce);
announce();
