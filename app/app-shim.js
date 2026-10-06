// UP Wallet app: the differences between the app and the site page, loaded before the page's own scripts.
// - The relay service lives on the site: its relative URLs ("relay/...") are sent there (and, on the
//   phone, through native HTTP: see app/native.js).
// - Links to the site's other pages, which the app does not contain, open in the phone's browser.
(function () {
  "use strict";
  const SITE = "__SITE__";   // filled in by scripts/build-web.js from app-config.json
  const PAGE = "__PAGE__";
  document.documentElement.classList.add("in-app");
  window.__upwalletSite = SITE;   // for app/native.js

  const toSite = (u) => SITE + u.replace(/^\.?\//, "");
  const ownFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (typeof input === "string" && /^\.?\/?relay\//.test(input)) input = toSite(input);
    return ownFetch(input, init);
  };

  // A link to a page of this app's origin that is not the wallet page: the same page on the site.
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === "/" + PAGE || url.pathname === "/") return;
    a.href = toSite(url.pathname.slice(1)) + url.search + url.hash;
  }, true);
})();
