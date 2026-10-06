// Test double of @metamask/connect-evm: records how the app creates the client and what the page asks.
export async function createEVMClient(options) {
  const calls = [], handlers = {};
  window.__mm = { options, calls, handlers, created: (window.__mm ? window.__mm.created : 0) + 1 };
  const provider = {
    async request(args) {
      calls.push(args.method);
      if (args.method === "eth_requestAccounts" || args.method === "eth_accounts") return ["0x406f822aC86b61d4cDf4cD84833f7e5561609C02"];
      if (args.method === "eth_chainId") return "0x2105";
      if (args.method === "personal_sign") return "0x" + "11".repeat(65);
      throw Object.assign(new Error("not in the test double: " + args.method), { code: 4200 });
    },
    on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
    removeListener() {},
  };
  return { getProvider: () => provider };
}
