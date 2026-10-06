# UP Wallet for Android (prototype)

The UP Wallet page of [Cross_Chain](https://github.com/ChainIntegrate/Cross_Chain) as an Android app,
built with Capacitor. The page is bundled in the app, taken from Cross_Chain at the commit in
`UPSTREAM.json`; the app adds only what a phone needs (`app/`).

Status: **phase 4**. The app installs, shows the page, uses MetaMask mobile to sign, connects to
dApps through WalletConnect links (pasted, opened with the app or shared to it) and can have the
site relayer pay the gas.

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
- The WalletConnect metadata shown to dApps names the site and its icon, not the app's origin.
- A MetaMask connection kept for fewer networks than asked is dropped before connecting (MetaMask
  answered "connection not found" to the old one).
- ethers is bundled from the npm package, checked against the page's own SRI hash; nothing is loaded
  from a CDN.
- `config.js` is generated from `app-config.json` (WalletConnect Project ID; on cloud.reown.com the
  project's allowed domains include `localhost`, the app's origin).

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

## Before the repository or the app goes public

- **App origin and Reown allowlist**: the app runs as `https://localhost` (Capacitor's default), and
  `localhost` is in the allowed domains of the Reown project, so any page served on localhost may use
  that Project ID. Set `server.hostname` in `capacitor.config.json` to a subdomain we own (e.g.
  `upwallet.chainintegrate.it`; no DNS record needed), then on cloud.reown.com add it and remove
  `localhost`. App data (remembered UP and network, MetaMask connection) is reset once by the change.
- Optionally a separate Reown project for the app (own quota and statistics).
- Release signing key outside the repository (`prototype.keystore` is for this prototype only).
- Privacy policy page (on the site) for the Play Store listing.
- Remove or keep, by choice, the "MetaMask opened" lines in the log (added for the prototype tests).
