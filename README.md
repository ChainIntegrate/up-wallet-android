# UP Wallet for Android (prototype)

The UP Wallet page of [Cross_Chain](https://github.com/ChainIntegrate/Cross_Chain) as an Android app,
built with Capacitor. The page is bundled in the app, taken from Cross_Chain at the commit in
`UPSTREAM.json`; the app adds only what a phone needs (`app/`).

Status: **prototype (0.8.1), phases 1-4 done**, tested on an Android phone (ColorOS) with OpenSea,
Uniswap and hup.social on Base, Arc and LUKSO: the app installs, shows the page, uses MetaMask mobile
to sign, connects to dApps through WalletConnect links (pasted, opened with the app, shared to it or
scanned from a QR code), has the site relayer pay the gas (the page's card says who pays, site or
controller, and changes it with a tap), notifies dApp requests that arrive in the background, stays running while a
dApp is connected and goes back to the dApp. Sending from the UP (currency, tokens, NFTs) was tested
on Base, Polygon and LUKSO. APKs are signed with the release key (section Signing). No store release
yet. See "Still to do" below.

**Download**: the APK of each version is attached to its
[release](https://github.com/ChainIntegrate/up-wallet-android/releases). On the phone, open the
`.apk` and allow installing from that source when Android asks; if Play Protect warns that the app is
unknown, choose "More details" → "Install anyway" (the app is not on the Play Store). Updates install
over the previous version, keeping its data. You need MetaMask mobile, with your Universal Profile's
controller account in it. The site's guide has the same steps.

Privacy policy: [up-wallet-app-privacy.html](https://crosschain-lukso.chainintegrate.it/up-wallet-app-privacy.html)
on the site.

## What the app adds to the page

- `app/app-shim.js`: relay calls (`relay/...`) go to the site (`app/native.js` sends them through
  Android's HTTP stack, CapacitorHttp: from the app's origin the web view's cross-origin rules would
  block them; the relay and the sponsor service check UP, controller, limits and paymaster as for the
  site, and their origin check only applies to requests that carry an Origin); links to the site's other pages open in
  the phone's browser.
- `app/app.css`: long addresses, hashes and links wrap inside their box (request window, status, log).
- The page's Content-Security-Policy (since 0.7.25): the site's page carries a `<meta>` policy whose
  `script-src` allows only its own files and its inline scripts by their SHA-256 hash, so a script
  injected into the page does not run. `scripts/build-web.js` changes one inline script (the
  WalletConnect metadata), so it computes the hashes again on the final page and drops the CDN from the
  policy (ethers is bundled). The app's scripts are files, allowed as `'self'`. Capacitor's bridge is
  injected at document start by the WebView, outside the page's policy; only a WebView too old for that
  (without `DOCUMENT_START_SCRIPT`) would fall back to an inline script that the policy blocks, and the
  native features would not work there.
- `app/metamask.js` (bundled with esbuild): MetaMask mobile as the page's signing wallet. It is
  announced to the page through EIP-6963 as "MetaMask (app)", the way the browser extension is, and
  backed by MetaMask Connect (`@metamask/connect-evm`), which reaches the MetaMask app through
  MetaMask's relay and opens it with `metamask://` links for each confirmation. Analytics are off.
  Networks MetaMask does not know (LUKSO among them) are added with their parameters from `chains.js`
  when the page switches to them. The page code does not change.
- `app/native.js` (bundled): a Paste button for the WalletConnect link; a `wc:` link opened with the
  app or text shared to it (Share -> UP Wallet) is put in the link field (the native side is
  `IncomingLinkPlugin.java`); connecting still takes a tap on the page's button. The UP address and
  the network are remembered on the phone.
- "Scan QR" (since 0.7.24), next to Paste: for a dApp open on another screen (a computer) that shows its
  WalletConnect QR code. Google Play services' code scanner (`@capacitor-mlkit/barcode-scanning`, its
  `scan()` only) handles the camera, so the app has **no camera permission** and receives only the
  text of the code; the `wc:` link in it goes in the field like a shared one (also when it is wrapped in
  a wallet's link, `...?uri=wc%3A...`). Play services downloads the scanner when the app is installed
  (`com.google.mlkit.vision.DEPENDENCIES` = `barcode_ui` in the manifest); if it is not there yet, the
  app asks for the download and says to try again in a few seconds. A phone without Google Play services
  has no scanner: Paste and shared links still work.
- UP Wallet announces its own link, `upwallet://`, in the WalletConnect metadata: a dApp that honours
  it opens UP Wallet (not another wallet app) when it sends a request. "Back to the dApp" goes to the
  dApp's own app when the dApp announced its link (`redirect.native`), else to the app that opened a
  link to UP Wallet (Android's referrer), else to an app installed for the dApp's site (an installed
  web app / PWA, or the site's own app: an app that opens the dApp's https address but not any
  address, so browsers do not count), else to the default browser.
- Panel 3 has a hint and a button to Android's settings of the "dApp requests" notifications: some
  phones (ColorOS among them) keep pop-up notifications off for apps installed from an APK.
- A dApp request that arrives while UP Wallet is in the background shows a notification (Capacitor
  Local Notifications; Android asks for the permission when you connect MetaMask or a dApp): a tap
  brings UP Wallet to the front. Once the dApp has its answer, a "Back to the dApp" button returns to
  it as above (the default browser comes back on the tab it was showing).
- While a dApp is connected, the app stays running (`KeepAliveService`, a foreground service with an
  ongoing notification): otherwise Android freezes it after a few minutes in the background and a
  dApp's request waits until UP Wallet is opened by hand. Stopped when no session is left. Type
  "special use" on Android 14+ (no daily limit), dataSync before. Up to 0.7.11 it was dataSync
  everywhere: on Android 15+ that type has a limit of about 6 hours a day, and once it was used up,
  starting the service crashed the app (seen when tapping Connect with a session to restore). Since
  0.7.12 a refused service no longer crashes the app: it goes on without it, and the diagnostic log
  says "Keep-alive not available" with Android's reason.
- Send from the UP (the page's panel 6): the UP's balances (currency, tokens and NFTs, from the chain
  and an index: Alchemy with the `ALCHEMY_KEY` secret, else Blockscout; `asset-list.js` is bundled;
  spam-flagged ones on request), a recipient by address or by Universal Profile name (LUKSO's profile
  index), the network's currency, an ERC-20 / LSP7 token or an NFT (LSP8, ERC-721, ERC-1155), with an
  "All" button, through the same window, simulation and signature as dApp requests, and the result
  read again on the chain after the send. After such a send there is no dApp to go
  back to: "Back to the dApp" stays hidden.
- Panel 2 has no "Read the address from the UP extension" button: it needs the LUKSO browser
  extension, which a phone does not have. The address is typed or pasted, and remembered.
- Under the page's footer, the notice MetaMask Connect's license asks for, with links to the
  third-party notices and to the privacy policy.
- A diagnostic log (`app/diag.js`, at most 300 lines, kept on the phone): app start, foreground and
  background, MetaMask requests and their outcome, dApp requests, notifications. No messages,
  amounts, signatures or addresses. Shown at the bottom of the page with Copy and Clear buttons.
- Panel 3 suggests MetaMask's Auto-lock at 5 minutes: when MetaMask locks with a request open, it
  drops it and the page gets "User rejected".
- The WalletConnect metadata shown to dApps names the site and its icon, not the app's origin.
- A MetaMask connection kept for fewer networks than asked is dropped before connecting (MetaMask
  answered "connection not found" to the old one).
- ethers is bundled from the npm package, checked against the page's own SRI hash; nothing is loaded
  from a CDN.
- The Alchemy API key (token lists in the send panel) is the site's, given to the build as the
  `ALCHEMY_KEY` repository secret and never stored in the repository. Like on the site it is protected
  by Alchemy's allowed-origins list (which must include `upwallet.chainintegrate.it`), not by being
  secret. Without it the token lists come from Blockscout only, which misses some tokens.
- `config.js` is generated from `app-config.json` (WalletConnect Project ID; on cloud.reown.com the
  project's allowed domains include `upwallet.chainintegrate.it`, the app's origin).
- The app's origin is `https://upwallet.chainintegrate.it` (`server.hostname` in `capacitor.config.json`):
  a name we own, served by the app itself (no DNS record needed), so the Reown allowlist names only us.
  `localhost` is no longer in the allowlist: older builds (origin `https://localhost`) cannot connect to dApps.
- A MetaMask connection resumed from storage may bring back the network used before; before each request
  the connection is put back on the page's network when that network is approved (a local change).
- A MetaMask connection removed in MetaMask (its connected apps) stays stored in the app, and MetaMask
  Connect resumes it without opening MetaMask: requests then never reach MetaMask. When Connect MetaMask
  resumes a connection without opening MetaMask, or opens nothing for 15 s, the log says so, and a
  "Connect MetaMask from scratch" button (under Connect MetaMask) drops the stored connection and reloads
  the page; network and UP are kept, dApp sessions too. The next Connect MetaMask makes a new connection.

The app holds no keys: signing stays in MetaMask. Backups of app data are off (`allowBackup="false"`).

## Build

- **CI**: every push builds the APK (GitHub Actions, "Android APK"). Download it from the run's
  artifacts (`up-wallet-apk`), unzip, and install the `.apk` on the phone (allow installing from this
  source when Android asks); artifacts are kept 30 days and need a GitHub sign-in. The run's summary
  says which key signed it: "Release key" with the certificate's SHA-256 fingerprint
  (`c70a8909…154446`), or a "Debug key" warning.
- **Releases**: publish a release on GitHub (Releases -> Draft a new release) with a new tag
  `v<versionName>` (for example `v0.7.3`) on `main`. CI builds the APK, attaches it to the release and
  writes the signer's fingerprint in its notes. The tag must match `versionName` in
  `android/app/build.gradle`, and the release key must be available, or no APK is attached.
- **Locally** (needs the Android SDK and JDK 21):

  ```
  npm ci
  npm run web            # or: CROSS_CHAIN_DIR=../Cross_Chain npm run web (that checkout must be at the pinned commit)
  npm test               # phone layout, MetaMask, native features (needs Playwright and Chromium)
  npx cap sync android
  cd android && ./gradlew assembleDebug    # signed with this machine's debug key
  ```

To take a newer version of the page, change the commit in `UPSTREAM.json`.

## Versions

`versionName` is `major.minor.patch`; `versionCode` (in `android/app/build.gradle`) goes up by 1 with
every published build, whatever the name. The release tag is `v<versionName>`.

- **0.x: prototype.** Installed from the APK on GitHub, outside the Play Store. Today: 0.8.x.
- **patch** (0.7.24 → 0.7.25): fixes and small additions, and a page update from Cross_Chain.
- **minor** for the intermediate milestones:
  - **0.8.0** (done): call decoding from any verified contract's ABI (Base, Arbitrum One, Arc), contracts
    named as the explorer names them, DeFi decoders (swaps, bridges, Spark), the "Every network" view with
    prices and token images;
  - **0.9.0**: the Play Store candidate, for the closed test.
- **1.0.0: first public release on the Play Store**, once all of these hold:
  1. the Play Store closed test is passed (for a personal developer account, about 12 testers for 14
     days: check the current rule in the Play Console) and the store listing is approved;
  2. the audit points that concern the app are closed (WalletConnect telemetry and SRI, CSP and the
     other low ones in Cross_Chain's AUDIT.md): **done in 0.7.25**, see "Security reviews";
  3. the privacy policy and the terms are final, with no "beta" or "in testing";
  4. signing with MetaMask, connecting to dApps (link, share, QR), sending from the UP and the gas paid
     by the site work on the phone with no open problem (see "Still to do").
- After 1.0.0: major for changes that break what users rely on (for example a new data format on the
  phone), minor for new features, patch for fixes.

## Signing

The release key never enters the repository. CI reads it from two repository secrets,
`UPW_KEYSTORE_B64` (the PKCS#12 file in base64, key alias `upwallet`) and `UPW_KEYSTORE_PASSWORD`,
writes it to a temporary file for the build and deletes it afterwards. Each APK it builds,
`up-wallet-<commit>.apk`, is signed with that key and installs over the previous one.

Without the secrets (pull requests from forks, local builds) the build makes a debug APK,
`up-wallet-<commit>-debug.apk`, signed with a throwaway key: Android refuses it as an update of the
installed app. Keep a copy of the release key offline: without it, no update of the installed app is
possible (users would have to uninstall and lose the app's data).

## Security reviews

The app was in the scope of the AI-assisted review of 2026-10-12 (Cross_Chain `AUDIT.md`, section 13):
manifest, the Java plugins and the native bridge (`app/*.js`). No finding on the app's own code beyond
two Info items: the `uuid` advisory reaching the app through `@metamask/connect-evm` (no upstream fix
yet; negligible for this use), and "Back to the dApp" opening a link the dApp announces (a plain VIEW
intent, only on the user's tap, with dangerous schemes filtered). The High found in that review (W-H1:
32-byte signatures refused only on the chosen network) was in the bundled page; the app carries the fix
from 0.7.15.

The items still open after that review were fixed in Cross_Chain on 2026-10-19 (`AUDIT.md`, rev. 12),
and the app carries them from 0.7.25: WalletConnect telemetry off and the WalletConnect bundle loaded
with Subresource Integrity (W-tel); the page's Content-Security-Policy, with its hashes computed again
by the build (N-3, see "What the app adds to the page"); signatures not made out to the UP flagged
(SIWE, Permit, EIP-3009) and a token that answers `false` refused (I-7, L-8). Not a professional audit.

## License

MIT for this repository's code ([LICENSE](LICENSE)). The APK also contains third-party code under
other terms, MetaMask Connect and the WalletConnect bundle among them: see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Still to do

Open from the phone tests:
- **Long background**: with the keep-alive service and the renderer kept important
  (`setRendererPriorityPolicy`), the app stayed awake in the latest phone tests: requests arrived and
  the notification was created. On ColorOS the notification showed in the shade but not as a pop-up
  until "Banner notifications" is turned on (the app now explains it and opens the setting).
  Battery usage "Unrestricted" is also advisable.
- **hup.social (app)** opens the LUKSO UP app on each request (through its profile.link links), not
  the connected wallet; the request reaches UP Wallet anyway (notification). hup announces no app
  link of its own and, with the WalletConnect link pasted, there is no referrer. 0.7.11 looks for an
  app installed for hup's site first; on the test phone hup runs in Chrome, so "Back to the dApp"
  returns to Chrome, which is where hup is (confirmed on 0.7.12). Since 0.7.13 the request window
  decodes hup's posts, replies and likes on LUKSO too, LSP26 follows and hup's chat sign-in. Still to check: whether hup honours the `upwallet://` link
  UP Wallet announces, and whether sharing hup's link to UP Wallet (instead of pasting it) gives a
  referrer.
- **Way back from MetaMask**: after confirming, the user returns to UP Wallet by hand (MetaMask does
  not return to the calling app). Look for a MetaMask Connect option or a return link, if any.
- **MetaMask cancels open requests when it locks** (auto-lock shorter than the time to read and
  confirm, 30 s in the tests): the page shows "User rejected". The app suggests 5 minutes; a clearer
  message for an unexpected 4001 (rejected without the user's tap) could follow.
- **Sign-in requests**: MetaMask always shows "Suspicious sign-in request" with two confirmations,
  because the request comes from UP Wallet, not from the dApp's site. Expected; explained in the
  page (Cross_Chain#123). Nothing to fix unless MetaMask changes.

Improvements:
- **OpenSea purchases decoded** in the request window (Seaport 1.6 `fulfillBasicOrder_efficient`,
  selector `0x00000000`, and OpenSea's newer contract `0x4cD0…BC31`, selector `0x49290c1c`): today
  they show as "call not recognised". This belongs to the page in Cross_Chain, for the site too.
- A dApp on a chain other than the one chosen in the page (OpenSea's cross-chain checkout) is refused
  by design: one UP, one network per session. Explain it better in the page, or accept it.
- iPhone: not started (needs an Apple developer account and a review; MetaMask Connect and
  WalletConnect work there too, the native parts differ).
- Listing in Reown's wallet registry, so that dApps show UP Wallet in their list (needs a store
  release first).

Prototype parts to decide on before a release:
- The diagnostic log (`app/diag.js`) and the "MetaMask opened" lines in the page's log: keep (useful
  for support), hide behind a setting, or remove.
- The build patches to MetaMask Connect (request timeout 5 minutes, connection renewed on focus,
  `scripts/build-web.js`): check them at every MetaMask Connect update (the build fails if they no
  longer apply).

## Before a store release

The repository is public (since 8 October 2026), with the release key in CI secrets and the third-party
notices in place. Before a Play Store release:
- the privacy policy on the site names ChainIntegrate with info@chainintegrate.it: add the legal
  entity once it exists; the server keeps its logs no longer than the policy says (30 days);
- optionally a separate Reown project for the app (own quota and statistics);
- **licenses**: MetaMask Connect allows non-commercial use or up to 10,000 monthly active users;
  beyond that, a license from ConsenSys or another library (THIRD_PARTY_NOTICES.md);
- remove or keep, by choice, the "MetaMask opened" lines in the log (added for the prototype tests);
- the "special use" foreground service (`KeepAliveService`, Android 14+) needs a declaration in the
  Play Console explaining the use (the text is in the manifest's `PROPERTY_SPECIAL_USE_FGS_SUBTYPE`).
