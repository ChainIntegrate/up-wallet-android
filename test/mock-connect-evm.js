// Test double of @metamask/connect-evm: records how the app creates the client and what the page asks.
export async function createEVMClient(options) {
  const calls = [], handlers = {};
  let chain = "0x1";
  window.__mm = { options, calls, handlers, created: (window.__mm ? window.__mm.created : 0) + 1 };
  const provider = {
    async request(args) {
      calls.push(args.method);
      if (args.method === "eth_requestAccounts" || args.method === "eth_accounts") return ["0x406f822aC86b61d4cDf4cD84833f7e5561609C02"];
      if (args.method === "eth_chainId") return chain;
      if (args.method === "personal_sign") return "0x" + "11".repeat(65);
      throw Object.assign(new Error("not in the test double: " + args.method), { code: 4200 });
    },
    on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
    removeListener() {},
  };
  window.__mm.connects = []; window.__mm.switches = [];
  return {
    getProvider: () => provider,
    async connect({ chainIds }) { window.__mm.connects.push(chainIds); chain = chainIds[0]; return { accounts: ["0x406f822aC86b61d4cDf4cD84833f7e5561609C02"], chainId: chain }; },
    async switchChain({ chainId }) { window.__mm.switches.push(chainId); if (chainId !== chain) { chain = chainId; (handlers.chainChanged || []).forEach((f) => f(chainId)); } },
  };
}
