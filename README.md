# UP Wallet for Android (prototype)

The UP Wallet page of [Cross_Chain](https://github.com/ChainIntegrate/Cross_Chain) as an Android app,
built with Capacitor. The page is bundled in the app, taken from Cross_Chain at the commit in
`UPSTREAM.json`; the app adds only what a phone needs (`app/`).

Status: **phase 2**. The app installs, shows the page and uses MetaMask mobile to sign; opening
WalletConnect links from dApps (phase 3) and the site relayer (phase 4) come next.

## What the app adds to the page

- `app/app-shim.js`: relay calls (`relay/...`) go to the site; links to the site's other pages open in
  the phone's browser.
- `app/app.css`: long addresses, hashes and links wrap inside their box (request window, status, log).
- `app/metamask.js` (bundled with esbuild): MetaMask mobile as the page's signing wallet. It is
  announced to the page through EIP-6963 as "MetaMask (app)", the way the browser extension is, and
  backed by MetaMask Connect (`@metamask/connect-evm`), which reaches the MetaMask app through
  MetaMask's relay and opens it with `metamask://` links for each confirmation. Analytics are off.
  The page code does not change.
- ethers is bundled from the npm package, checked against the page's own SRI hash; nothing is loaded
  from a CDN.
- `config.js` is generated from `app-config.json`.

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
