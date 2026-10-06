// UP Wallet app (prototype): a diagnostic log that survives app restarts, to tell apart what happens
// when the app goes to MetaMask and back: app start, leaving and coming back, MetaMask openings,
// requests to MetaMask and their outcome, requests from dApps. Only names and outcomes: no messages,
// signatures or amounts. Kept on the phone (the app's storage), last 300 lines; shown at the bottom of
// the page with a Copy button.
(function () {
  "use strict";
  const KEY = "upwallet.diag", MAX = 300;
  const en = () => document.documentElement.lang === "en";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  let lines = load();
  let box = null;
  const stamp = () => { const d = new Date(); return d.toLocaleDateString() + " " + d.toLocaleTimeString(); };

  function add(text) {
    lines.push(`${stamp()} ${String(text).slice(0, 160)}`);
    if (lines.length > MAX) lines = lines.slice(-MAX);
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch (e) { /* not kept */ }
    if (box) box.textContent = lines.join("\n");
  }
  window.upwDiag = { add };

  add(en() ? "App started (page loaded)." : "Avvio dell'app (pagina caricata).");
  document.addEventListener("visibilitychange", () => {
    add(document.visibilityState === "visible" ? (en() ? "App in the foreground." : "App in primo piano.") : (en() ? "App in the background." : "App in secondo piano."));
  });

  document.addEventListener("DOMContentLoaded", () => {
    const log = document.getElementById("log");
    if (!log) return;
    // Requests from dApps and errors, as the page writes them in its log (first part only).
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        const t = (n.textContent || "").trim();
        if (/^(Richiesta dalla dApp|Request from the dApp|Richiesta di connessione|Connection request)/.test(t)) add("dApp: " + t.split(" — ")[0].split(":").slice(0, 2).join(":"));
        else if (/Operazione eseguita|Operation executed|Firma ricevuta|Signature received/.test(t)) add(t.split(".")[0]);
        else if (/^(Errore|Error|could not)/i.test(t)) add(t.split("(")[0]);
      }
    }).observe(log, { childList: true });

    const wrap = document.createElement("details");
    wrap.style.cssText = "margin-top:14px;";
    const sum = document.createElement("summary");
    sum.textContent = en() ? "Diagnostic log (app)" : "Registro diagnostico (app)";
    const copy = document.createElement("button");
    copy.type = "button"; copy.className = "secondary";
    copy.textContent = en() ? "Copy" : "Copia";
    copy.addEventListener("click", async () => {
      const text = lines.join("\n");
      try { await navigator.clipboard.writeText(text); copy.textContent = en() ? "Copied" : "Copiato"; }
      catch (e) { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); copy.textContent = en() ? "Copied" : "Copiato"; }
      setTimeout(() => { copy.textContent = en() ? "Copy" : "Copia"; }, 2000);
    });
    const clear = document.createElement("button");
    clear.type = "button"; clear.className = "secondary";
    clear.textContent = en() ? "Clear" : "Svuota";
    clear.addEventListener("click", () => { lines = []; try { localStorage.removeItem(KEY); } catch (e) { /* nothing */ } box.textContent = ""; });
    box = document.createElement("pre");
    box.style.cssText = "white-space:pre-wrap; overflow-wrap:anywhere; font-size:11.5px; max-height:320px; overflow:auto;";
    box.textContent = lines.join("\n");
    wrap.append(sum, copy, clear, box);
    log.insertAdjacentElement("afterend", wrap);
  });
})();
