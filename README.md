# UP Wallet for Android (prototype)

The UP Wallet page of [Cross_Chain](https://github.com/ChainIntegrate/Cross_Chain) as an Android app,
built with Capacitor. The page is bundled in the app, taken from Cross_Chain at the commit in
`UPSTREAM.json`; the app adds only what a phone needs (`app/`).

Status: **prototype, phases 1-4 done**, tested on an Android phone (ColorOS) with OpenSea, Uniswap and
hup.social on Base and Arc: the app installs, shows the page, uses MetaMask mobile to sign, connects
to dApps through WalletConnect links (pasted, opened with the app or shared to it), has the site
relayer pay the gas, notifies dApp requests that arrive in the background, stays running while a dApp
is connected and goes back to the browser. APKs are signed with the release key (section Signing).
No store release yet. See "Still to do" below.

**Download**: the APK of each version is attached to its
[release](https://github.com/ChainIntegrate/up-wallet-android/releases). On the phone, open the
`.apk` and allow installing from that source when Android asks. You need MetaMask mobile, with your
Universal Profile's controller account in it.

Privacy policy: [up-wallet-app-privacy.html](https://crosschain-lukso.chainintegrate.it/up-wallet-app-privacy.html)
on the site.

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
  source when Android asks); artifacts are kept 30 days and need a GitHub sign-in. The run's summary
  says which key signed it: "Release key" with the certificate's SHA-256 fingerprint
  (`c70a8909…154446`), or a "Debug key" warning.
- **Releases**: pushing a tag `v<versionName>` (for example `v0.7.3`) builds the APK and publishes it
  as a GitHub pre-release, with the signer's fingerprint in the notes. The tag must match
  `versionName` in `android/app/build.gradle`, and the release key must be available, or nothing is
  published.
- **Locally** (needs the Android SDK and JDK 21):

  ```
  npm ci
  npm run web            # or: CROSS_CHAIN_DIR=../Cross_Chain npm run web (that checkout must be at the pinned commit)
  npm test               # layout at phone width (needs Playwright)
  npx cap sync android
  cd android && ./gradlew assembleDebug    # signed with this machine's debug key
  ```

To take a newer version of the page, change the commit in `UPSTREAM.json`.

## Signing

The release key never enters the repository. CI reads it from two repository secrets,
`UPW_KEYSTORE_B64` (the PKCS#12 file in base64, key alias `upwallet`) and `UPW_KEYSTORE_PASSWORD`,
writes it to a temporary file for the build and deletes it afterwards. Each APK it builds,
`up-wallet-<commit>.apk`, is signed with that key and installs over the previous one.

Without the secrets (pull requests from forks, local builds) the build makes a debug APK,
`up-wallet-<commit>-debug.apk`, signed with a throwaway key: Android refuses it as an update of the
installed app. Keep a copy of the release key offline: without it, no update of the installed app is
possible (users would have to uninstall and lose the app's data).

## License

MIT for this repository's code ([LICENSE](LICENSE)). The APK also contains third-party code under
other terms, MetaMask Connect and the WalletConnect bundle among them: see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Still to do

Open from the phone tests:
- **Long background**: with the keep-alive service and the renderer kept important
  (`setRendererPriorityPolicy`), the app stayed awake in the latest phone tests: requests arrived and
  the notification was created. On ColorOS the notification showed in the shade but not as a pop-up:
  the "dApp requests" category needs "Banner notifications" turned on in Android's settings (off by
  default for apps installed from an APK). Explain this in the app, or check it at first start.
  Battery usage "Unrestricted" is also advisable.
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
- remove or keep, by choice, the "MetaMask opened" lines in the log (added for the prototype tests).
