# UP Wallet for Android (prototype)

The UP Wallet page of [Cross_Chain](https://github.com/ChainIntegrate/Cross_Chain) as an Android app,
built with Capacitor. The page is bundled in the app, taken from Cross_Chain at the commit in
`UPSTREAM.json`; the app adds only what a phone needs (`app/`).

Status: **prototype (0.9.x)**. Since 0.9.0 the app is the wallet: it signs with a key kept on the
phone (section "The phone key"); up to 0.8.x it signed through MetaMask mobile. Tested on an Android
phone (ColorOS) with OpenSea, Uniswap and hup.social on Base, Arc and LUKSO: the app installs, shows the
page, connects to dApps through WalletConnect links (pasted, opened with the app, shared to it or
scanned from a QR code), has the site relayer pay the gas (the page's card says who pays, site or
controller, and changes it with a tap), notifies dApp requests that arrive in the background, stays running while a
dApp is connected and goes back to the dApp. Sending from the UP (currency, tokens, NFTs) was tested
on Base, Polygon and LUKSO. The phone key (0.9.0) was tested live on Base (a hup.social post, gas paid
by the site relayer), Arc and LUKSO (the phone key paying the gas); since 0.9.2 the app keeps several
UPs and switches among them from the card. APKs are signed with the release key (section Signing). No
store release yet. See "Still to do" below.

**Not an official LUKSO product**: an independent, open-source project by ChainIntegrate, free to use at
one's own risk (the app warns at its first start). Everything the app runs is in this repository and in
[Cross_Chain](https://github.com/ChainIntegrate/Cross_Chain), whose README has the links to the website
and its tools, and whose `AUDIT.md` publishes every review with its open items. **Help:** when the
wallet meets a call it cannot explain, it offers to copy the call's data or to e-mail it; sending it
lets the next version decode that call for everyone. Bugs as GitHub issues; security problems privately,
as in Cross_Chain's [SECURITY.md](https://github.com/ChainIntegrate/Cross_Chain/blob/main/SECURITY.md).

**Download**: the APK of each version is attached to its
[release](https://github.com/ChainIntegrate/up-wallet-android/releases). On the phone, open the
`.apk` and allow installing from that source when Android asks; if Play Protect warns that the app is
unknown, choose "More details" → "Install anyway" (the app is not on the Play Store). Play Protect may
also offer to scan the app at an update: the scan is Google's check of apps from developers it has
not verified yet, not a change in the app (see [docs/developer-verification.md](docs/developer-verification.md)).
Updates install over the previous version, keeping its data. You need a Universal Profile with an
admin controller you can use on a computer (for example in MetaMask), to authorize the phone key once
on each network. The site's guide has the same steps.

## The phone key (since 0.9.0)

> **⚠️ Experimental: the maintainer's own wallet.** The app keeps a signing key on the phone.
> That is a higher risk than signing in an external wallet: whoever can unlock the phone and pass its
> fingerprint or PIN can sign with that key. Use it only if you understand how a Universal Profile's
> controllers and permissions work, with small amounts, at your own risk. MIT license: no warranty.

How it works:
- **No MetaMask in the app.** A dApp connects through WalletConnect (link, share or QR) and the app
  signs by itself: no other app in between.
- **A new key, created on the phone** the first time "Use the phone key" is pressed. It never leaves the phone: it is encrypted with
  the Android Keystore (the phone's secure hardware where there is one), used only after fingerprint or
  PIN, **for every signature**, and the signature is made in the app's native code, so the page never
  sees the key. There is no seed phrase and no copy: app data is not backed up (`allowBackup="false"`),
  and uninstalling the app or losing the phone loses the key. That is handled by revoking it.
- **Authorized once per network, from the site.** The app shows the key's address (copy, QR). On a
  computer, the site's **Backup** page, "Authorize a device", adds it as a controller of the UP on that
  network, signed by an admin controller of the UP (for example in MetaMask on the computer), with
  **no admin permissions, but access to all the UP's funds** (whoever unlocks the phone and passes the
  fingerprint or PIN can move them):

  | Permission | For |
  |---|---|
  | `SUPER_CALL`, `SUPER_TRANSFERVALUE` | dApps and sends |
  | `SIGN` | signatures for dApps (ERC-1271) |
  | the 4337 permission | gas paid by the site |
  | `SETDATA`, only on `LSP3Profile` | aligning the profile |

  Never adding controllers, editing permissions or extensions: those stay with the admin keys (the
  genesis key, the backup). The same page revokes a lost phone's key, network by network.
- **The panel "This phone"** (`app/phone-key.js`): the key's address (copy, QR), its name kept on the UP on
  the page's network (given on the Backup page), the link to the Backup page (it fills in the key, the UP,
  the network and "Phone · UP Wallet app" as the name to start from), the key's own balance on that network
  (what it pays gas with when it sends a transaction itself) with "Send the key's balance to the UP" (one
  plain transfer to the page's UP, the balance minus the maximum fee, after the fingerprint: a lost key
  has no copy, and neither has its balance), delete. At every opening the key connects by itself (it only
  reads its address, no fingerprint), with the last UP used and the network.
- **The fingerprint prompt says what is signed**, from the signed data: the message's text, the typed
  data's domain, the transaction's network, recipient, value and function, and for a transaction to the
  UP's Key Manager (`execute(bytes)`) what the UP does inside (each call's recipient, value and function),
  as for a gas-relay operation.
- **One key per device, by choice.** No export, import, backup or sync of the key, not even encrypted: a
  new phone (or computer, with the browser extension) gets its own key and one "Authorize a device". Each
  device is a controller of its own, revoked alone if lost; a key that never leaves its device cannot be
  taken from a file or an account; and since device keys have no admin permissions, adding one always takes
  an admin controller (MetaMask), once, by design.
- **The page is the same as the site's**: the request window, its checks and simulation, the gas relay,
  sending from the UP, notifications, "Back to the dApp". Its texts name the phone key and the
  fingerprint instead of MetaMask (`html.phone-key`, set by `app/phone-key.js`).
- A warning at the first start, until accepted, with the text above.

First tested on the phone on 2026-10-25: the key created in the Keystore, authorized on Base from the
Backup page, a hup.social post signed with the fingerprint and sent by the site relayer (gas paid by
the paymaster).

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
- `app/phone-key.js` (bundled with esbuild): the phone key as the page's signing wallet, announced to
  the page through EIP-6963 as "Phone key (UP Wallet)", the way the browser extension is. It builds what
  is signed (the EIP-191 digest of a message, the EIP-712 digest of typed data, a transaction's hash) and
  asks the native `PhoneKey` plugin (`PhoneKeyPlugin.java`, `Secp256k1.java`) for the signature, which
  asks for the fingerprint or PIN each time; signed transactions go to the network's RPC. It follows the
  network chosen in the page; the fingerprint prompt says what is signed (for a transaction to the UP's
  Key Manager, what the UP does inside `execute(bytes)`). It also shows the first-start warning and, under
  panel 3's button, "This phone": the key's address (copy, QR), its name kept on the UP, the link to the
  site's Backup page with phone, UP, network and "Phone · UP Wallet app" filled in, the key's own balance
  with "Send the key's balance to the UP", and "Delete the phone key". At every opening the key connects
  by itself (no fingerprint), with the last UP used (section "The phone key").
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
  Local Notifications; Android asks for the permission when you connect the phone key or a dApp): a tap
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
- Under the page's footer, links to the third-party notices and to the privacy policy.
- A diagnostic log (`app/diag.js`, at most 300 lines, kept on the phone): app start, foreground and
  background, phone key signatures and their outcome, dApp requests, notifications. No messages,
  amounts, signatures or addresses. Shown at the bottom of the page with Copy and Clear buttons.
- The WalletConnect metadata shown to dApps names the site and its icon, not the app's origin.
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

The phone key is the only key the app holds (section "The phone key"). Backups of app data are off
(`allowBackup="false"`). Up to 0.8.x the app held no keys and signed through MetaMask mobile (MetaMask
Connect).

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
  npm test               # phone layout, phone key, native features (needs Playwright and Chromium)
  npx cap sync android
  cd android && ./gradlew assembleDebug    # signed with this machine's debug key
  ```

To take a newer version of the page, change the commit in `UPSTREAM.json`.

## Versions

`versionName` is `major.minor.patch`; `versionCode` (in `android/app/build.gradle`) goes up by 1 with
every published build, whatever the name. The release tag is `v<versionName>`.

- **0.x: prototype.** Installed from the APK on GitHub, outside the Play Store. Today: 0.9.x.
- **patch** (0.8.0 → 0.8.1): fixes and small additions, and a page update from Cross_Chain.
- **minor** for the intermediate milestones:
  - **0.8.0** (done): call decoding from any verified contract's ABI (Base, Arbitrum One, Arc), contracts
    named as the explorer names them, DeFi decoders (swaps, bridges, Spark), the "Every network" view with
    prices and token images;
  - **0.8.2** (patch): page batch of 2026-10-23 (Aave and CoW decoding, positions in "Every network",
    the UP's profile picture, the controller as fallback when the site relayer cannot take an
    operation); in the app, an error of a dApp request is notified when the app is in the background;
  - **0.9.0** (done): the phone key replaces MetaMask (section "The phone key");
  - **0.9.1** (patch): the gas relay's texts name the phone key too;
  - **0.9.2** (patch): switching among the UPs saved on the phone, from the card (one phone key can be
    authorized on several UPs);
  - **0.9.3** (patch): fixes of the 2026-10-26 external review: the phone key refuses opaque 32-byte
    messages itself and signs gas-relay operations from the operation (`upwallet_signUserOperation`);
    the fingerprint prompt says what is signed; only read methods reach the network's RPC; the page's
    fixes (wording of the phone key's permissions, the gas relay box when the key is not a controller);
  - **0.9.4** (patch): LUKSO Testnet (4201) among the page's networks; with a custom RPC the phone key
    reports the chain id the RPC gives (it answered 1, so the page's check failed);
  - **0.9.5** (patch): the page batch of 2026-10-28 (UP CIE Link statements explained and checked, the
    "Every network" view on a testnet, a version line at the bottom: the app's version and the page's
    commit); the "stays active" notification is silent and kept off the lock screen (a new quiet channel);
  - **0.9.6** (patch): page 0.10.0 (the page's numbered version, LUKSO as the starting network, the UP by
    name in panel 2); the site's Backup page now says "Authorize a device" (phone or computer);
  - **0.9.7** (patch): page 0.11.0 ("Only simulation" and the last UP remembered, the site relayer on by
    default, euro prices, the index read shown); the fingerprint prompt decodes the Key Manager's
    `execute(bytes)`; the panel "This phone" shows the key's name and its own balance, sent to the UP;
    the phone key connects by itself at every opening;
  - **0.9.x**: aligning the profile from the app; then the Play Store candidate, for the closed test.
- **1.0.0: first public release on the Play Store**, once all of these hold:
  1. the developer account is verified: an **organization** Play Console account, since Google
     requires one for crypto wallets (registered business, D-U-N-S number, website verified; see
     [docs/developer-verification.md](docs/developer-verification.md)), the store listing is approved
     and any test the console requires is passed;
  2. the audit points that concern the app are closed (WalletConnect telemetry and SRI, CSP and the
     other low ones in Cross_Chain's AUDIT.md): **done in 0.7.25**, see "Security reviews";
  3. the privacy policy and the terms are final, with no "beta" or "in testing";
  4. signing with the phone key, connecting to dApps (link, share, QR), sending from the UP and the gas
     paid by the site work on the phone with no open problem (see "Still to do");
  5. an external review of the app, its phone key included, with no open High or Medium finding: done
     on 2026-10-26 (Cross_Chain's `AUDIT.md` section 15), its findings fixed in 0.9.3.
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
two Info items: the `uuid` advisory reaching the app through `@metamask/connect-evm` (gone since
0.9.0, which no longer contains MetaMask Connect), and "Back to the dApp" opening a link the dApp announces (a plain VIEW
intent, only on the user's tap, with dangerous schemes filtered). The High found in that review (W-H1:
32-byte signatures refused only on the chosen network) was in the bundled page; the app carries the fix
from 0.7.15. The phone key (0.9.0: `PhoneKeyPlugin.java`, `Secp256k1.java`, `app/phone-key.js`) was reviewed in the
external AI-assisted review of 2026-10-26 (Cross_Chain `AUDIT.md`, section 15): "well engineered", no
Critical or High. Its Low items are fixed in 0.9.3: the key's own refusal of opaque 32-byte messages, with
gas-relay operations signed from the operation itself (PK-2); the fingerprint prompt showing what is signed
(PK-4); only read methods forwarded to the RPC. A professional audit is planned for the gas relay when
its paid service has significant users or funds (Cross_Chain's roadmap), not for the app.

The items still open after that review were fixed in Cross_Chain on 2026-10-19 (`AUDIT.md`, rev. 12),
and the app carries them from 0.7.25: WalletConnect telemetry off and the WalletConnect bundle loaded
with Subresource Integrity (W-tel); the page's Content-Security-Policy, with its hashes computed again
by the build (N-3, see "What the app adds to the page"); signatures not made out to the UP flagged
(SIWE, Permit, EIP-3009) and a token that answers `false` refused (I-7, L-8). Not a professional audit.

**Last review (2026-10-29).** The external AI-assisted review of the whole project (Cross_Chain's
`AUDIT.md`, section 17) covered the app at `8d3f363` (0.9.7), with the new browser extension: **not a
professional audit, but an in-depth one.** No Critical, High or Medium; the fixes of the 2026-10-26 review
verified in the code (PK-2 in `app/phone-key.js`); the Key Manager's `execute(bytes)` decoded in the
fingerprint prompt noted as trusted display. Nothing open on the app.

## License

MIT for this repository's code ([LICENSE](LICENSE)). The APK also contains third-party code under
other terms, the WalletConnect bundle and Bouncy Castle among them: see
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
- **Aave Pro on Arc** (pro.aave.com): the deposit stops inside Aave, before any request reaches the
  wallet, because Aave estimates gas through its own Arc node (`rpc.arc-scan.org`), which refuses
  web pages (CORS). Since 0.8.1 the page checks that node at connection and says the block is on
  Aave's side; the note goes away by itself once the node answers. On Base, Aave Pro works.

Improvements (changes to the page itself are collected in Cross_Chain's
[WALLET-BACKLOG.md](https://github.com/ChainIntegrate/Cross_Chain/blob/main/WALLET-BACKLOG.md) and made in batches):
- **OpenSea purchases decoded** in the request window (Seaport 1.6 `fulfillBasicOrder_efficient`,
  selector `0x00000000`, and OpenSea's newer contract `0x4cD0…BC31`, selector `0x49290c1c`): today
  they show as "call not recognised". This belongs to the page in Cross_Chain, for the site too.
- A dApp on a chain other than the one chosen in the page (OpenSea's cross-chain checkout) is refused
  by design: one UP, one network per session. Since 0.8.1 a switch request is refused with 4001 and the
  dApp is told the session's network, and the log says which network to choose in the dApp.
- iPhone: not started (needs an Apple developer account and a review; WalletConnect works there too,
  the native parts differ: the Secure Enclave would keep the phone key).
- Listing in Reown's wallet registry, so that dApps show UP Wallet in their list (needs a store
  release first).

Prototype parts to decide on before a release:
- The diagnostic log (`app/diag.js`): keep (useful for support), hide behind a setting, or remove.

## Before a store release

The repository is public (since 8 October 2026), with the release key in CI secrets and the third-party
notices in place. Before a Play Store release:
- **developer verification**: an organization Play Console account (Google requires one for crypto
  wallets: registered business, D-U-N-S number, website verified in Search Console, documents) on
  the Google account already created on ChainIntegrate's e-mail; the package registered with the
  release key; on Play, Play App Signing with the existing key so that installed APKs update. Steps and
  sources: [docs/developer-verification.md](docs/developer-verification.md). Google's global
  enforcement is planned for 2027;
- the privacy policy on the site names ChainIntegrate with info@chainintegrate.it: add the legal
  entity once it exists; the server keeps its logs no longer than the policy says (30 days);
- optionally a separate Reown project for the app (own quota and statistics);
- the store's data safety and financial features forms for a non-custodial wallet that keeps a key on
  the phone (the privacy policy already describes it, since 0.9.0);
- the external review of the app, its phone key included: done on 2026-10-26, fixed in 0.9.3;
- the "special use" foreground service (`KeepAliveService`, Android 14+) needs a declaration in the
  Play Console explaining the use (the text is in the manifest's `PROPERTY_SPECIAL_USE_FGS_SUBTYPE`).
