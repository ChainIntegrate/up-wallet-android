# Third-party notices

This repository's own code is under the MIT license ([LICENSE](LICENSE)). The APK built from it also
contains the third-party code below, each under its own terms.

## MetaMask Connect

`@metamask/connect-evm` and `@metamask/connect-multichain` (with the packages they bring in), bundled
into `www/app/metamask.js` by `scripts/build-web.js`. The build applies two small changes to
`@metamask/connect-multichain` (request timeout, connection renewed on focus), described in that script.

> This program uses MetaMask Connect. MetaMask Connect is the copyright of ConsenSys Software Inc.
> Copyright ConsenSys Software Inc. 2022. All rights reserved.

It is **not** under an open-source license. ConsenSys' license (in `node_modules/@metamask/connect-evm/LICENSE`
after `npm ci`) allows distribution, modification and combination with another program only for
Non-Commercial Use, which includes a program with no more than 10,000 monthly active users across all
its versions and platforms; it requires the notice above with each copy, and passes the same terms on
to the resulting program. The app shows the notice under the page's footer. Beyond those terms, a
license from ConsenSys (metamask.license@consensys.net) or another library is needed.

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
| Packages bundled with MetaMask Connect | their own licenses, in `node_modules` after `npm ci` |
