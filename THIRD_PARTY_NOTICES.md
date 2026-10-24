# Third-party notices

This repository's own code is under the MIT license ([LICENSE](LICENSE)). The APK built from it also
contains the third-party code below, each under its own terms.

## Bouncy Castle

`org.bouncycastle:bcprov-jdk18on` 1.78.1, used by `Secp256k1.java` for the phone key (secp256k1
signatures and Keccak-256), from 0.9.0. Under the Bouncy Castle license, an MIT-style license:

> Copyright (c) 2000-2024 The Legion of the Bouncy Castle Inc. (https://www.bouncycastle.org)

Up to 0.8.x the APK contained MetaMask Connect (ConsenSys' license); from 0.9.0 it does not.

## WalletConnect bundle (Reown)

`vendor/walletkit-1.6.0.min.js`, taken from the Cross_Chain repository at the commit pinned in
`UPSTREAM.json`, together with the UP Wallet page.

> Portions © 2025 Reown, Inc. All Rights Reserved

Under the WalletConnect Community License Agreement of Reown, Inc., which is not an open-source
license and has its own usage thresholds. The notice is in the page's footer; the license text and the
list of the other packages in the bundle are in the Cross_Chain repository
(`vendor/walletkit-1.6.0.LICENSE.md`, `vendor/walletkit-1.6.0.THIRD-PARTY.txt`,
`THIRD_PARTY_NOTICES.md`).

## Other components

| Component | License |
|---|---|
| UP Wallet page and its scripts (Cross_Chain) | MIT |
| ethers 6.13.4 | MIT |
| Capacitor (`@capacitor/*`) | MIT |
| Android Jetpack libraries (AndroidX), pulled in by Capacitor | Apache-2.0 |
| AndroidX Biometric (`androidx.biometric:biometric` 1.1.0), the fingerprint or PIN prompt of the phone key | Apache-2.0 |
| `@capacitor-mlkit/barcode-scanning` 8.2.1 (Capawesome), for "Scan QR" | Apache-2.0 |
| Google ML Kit barcode scanning and Google Play services code scanner (`com.google.mlkit:barcode-scanning`, `com.google.android.gms:play-services-code-scanner`), pulled in by that plugin | Google's terms for ML Kit and Google Play services (not open source; the ML Kit terms are at developers.google.com/ml-kit/terms) |
| AndroidX CameraX, pulled in by that plugin (its in-app camera mode, not used by the app) | Apache-2.0 |
