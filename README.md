# UP Wallet for Android (prototype)

The UP Wallet page of [Cross_Chain](https://github.com/ChainIntegrate/Cross_Chain) as an Android app,
built with Capacitor. The page is bundled in the app, taken from Cross_Chain at the commit in
`UPSTREAM.json`; the app adds only what a phone needs (`app/`).

Status: **prototype, phases 1-4 done** and tested on an Android phone with OpenSea on Base: the app
installs, shows the page, uses MetaMask mobile to sign, connects to dApps through WalletConnect links
(pasted, opened with the app or shared to it), has the site relayer pay the gas, notifies dApp
requests that arrive in the background and goes back to the browser. See "Still to do" below.

## What the app adds to the page

- `app/app-shim.js`: relay calls (`relay/...`) go to the site (`app/native.js` sends them through
  Android's HTTP stack, CapacitorHttp: from the app's origin the web view's cross-origin rules would
  block them; the relay and the sponsor service check UP, controller, limits and paymaster as for the
  site, and their origin check only applies to requests that carry an Origin); links to the site's other pages open in
  the phone's browser.
- `app/app.css`: long addresses, hashes and links wrap inside their box (request window, status, log).
- `app/metamask.js` (bundled with esbuild): MetaMask mobile as the page's signing wallet. It is
  announced to the page through EIP-6963 as "MetaMask (app)", the way the browser extension is, and
  backed by MetaMask Connect (`@metamask/connect-evm`), which reaches the MetaMask app through
  MetaMask's relay and opens it with `metamask://` links for each confirmation. Analytics are off.
  The page code does not change.
- `app/native.js` (bundled): a Paste button for the WalletConnect link; a `wc:` link opened with the
  app or text shared to it (Share -> UP Wallet) is put in the link field (the native side is
  `IncomingLinkPlugin.java`); connecting still takes a tap on the page's button. The UP address and
  the network are remembered on the phone.
- A dApp request that arrives while UP Wallet is in the background shows a notification (Capacitor
  Local Notifications; Android asks for the permission when you connect MetaMask or a dApp): a tap
  brings UP Wallet to the front. Once the dApp has its answer, a "Back to the dApp" button brings the
  default browser back to the front, on the tab it was showing.
- While a dApp is connected, the app stays running (`KeepAliveService`, a foreground service of type
  dataSync with an ongoing notification): otherwise Android freezes it after a few minutes in the
  background and a dApp's request waits until UP Wallet is opened by hand. Stopped when no session is
  left. Android 15+ limits this service type to about 6 hours a day.
- Panel 3 suggests MetaMask's Auto-lock at 5 minutes: when MetaMask locks with a request open, it
  drops it and the page gets "User rejected".
- The WalletConnect metadata shown to dApps names the site and its icon, not the app's origin.
- A MetaMask connection kept for fewer networks than asked is dropped before connecting (MetaMask
  answered "connection not found" to the old one).
- ethers is bundled from the npm package, checked against the page's own SRI hash; nothing is loaded
  from a CDN.
- `config.js` is generated from `app-config.json` (WalletConnect Project ID; on cloud.reown.com the
  project's allowed domains include `upwallet.chainintegrate.it`, the app's origin).
- The app's origin is `https://upwallet.chainintegrate.it` (`server.hostname` in `capacitor.config.json`):
  a name we own, served by the app itself (no DNS record needed), so the Reown allowlist names only us.
  `localhost` is no longer in the allowlist: older builds (origin `https://localhost`) cannot connect to dApps.
- A MetaMask connection resumed from storage may bring back the network used before; before each request
  the connection is put back on the page's network when that network is approved (a local change).

The app holds no keys: signing stays in MetaMask. Backups of app data are off (`allowBackup="false"`).

## Build

- **CI**: every push builds the APK (GitHub Actions, "Android APK"). Download it from the run's
  artifacts (`up-wallet-apk`), unzip, and install the `.apk` on the phone (allow installing from this
  source when Android asks).
- **Locally** (needs the Android SDK and JDK 21):

  ```
  npm ci
  npm run web            # or: CROSS_CHAIN_DIR=../Cross_Chain npm run web (that checkout must be at the pinned commit)
  npm test               # layout at phone width (needs Playwright)
  npx cap sync android
  cd android && ./gradlew assembleDebug
  ```

To take a newer version of the page, change the commit in `UPSTREAM.json`.

## Signing

APKs are signed with `android/app/prototype.keystore`, a key kept in the repository on purpose so
that each new APK installs over the previous one. It is for this prototype only: a Play Store release
will be signed with a different key that never enters the repository.

## Still to do

Open from the phone tests:
- **Long background test**: connect a dApp, leave UP Wallet in the background 10+ minutes, then act on
  the dApp; the request notification must arrive. Without the keep-alive service the app was frozen
  after ~7 minutes; with it (build `066f1cb`), still after ~8 minutes: the WebView's renderer is a
  separate process whose priority drops when the app is not visible. Build `66efc76`+1 keeps the
  renderer important in the background (`setRendererPriorityPolicy`); to be tested. Also suggest
  Battery usage "Unrestricted" for UP Wallet in Android's app settings.
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

## Before the repository or the app goes public

- Optionally a separate Reown project for the app (own quota and statistics).
- Release signing key outside the repository (`prototype.keystore` is for this prototype only).
- Privacy policy page (on the site) for the Play Store listing.
- Remove or keep, by choice, the "MetaMask opened" lines in the log (added for the prototype tests).
