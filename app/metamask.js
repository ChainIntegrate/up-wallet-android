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

const provider = {
  isUpWalletApp: true,
  async request(args) {
    const c = client || await start();
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

const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: INFO, provider }) }));
window.addEventListener("eip6963:requestProvider", announce);
announce();
