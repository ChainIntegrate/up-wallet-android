# Android developer verification: plan for UP Wallet

Status on 2026-10-21. Google's rules and dates change: check the official pages linked at the end
before each step.

## Why

Google is making developer verification mandatory for apps installed on certified Android devices,
including apps installed from outside Google Play, as UP Wallet is today (an APK from GitHub
releases). Until the developer and the app are registered, Play Protect treats the app as coming
from an unknown developer: today this means a scan, or a warning, at install and at updates.

Timeline published by Google:
- **August 2026**: developer APIs, limited distribution accounts and the advanced install flow
  for power users;
- **30 September 2026**: enforcement starts in Brazil, Indonesia, Singapore and Thailand;
- **2027 and beyond**: global rollout, Italy and the rest of the EU included.

Nothing in the app changed to cause the current scans: same signing key, same permissions since
0.7.24.

## Which account: an organization account

The app is meant for Google Play (0.9.x candidate, 1.0.0 first public release, see README
"Versions"), so the account is a **Google Play Console** account: Google says it is the single
place to manage verification for apps distributed both on and outside Play.

**A crypto wallet needs an organization account.** Google's "Play Console requirements" (point 1.1)
say that developers of financial products and services, *cryptocurrency software wallets* and
exchanges included, must register as an organization. The Play Console's sign-up shows it too:
choosing "crypto wallet or exchange apps" warns that some apps in that category can be distributed
only by organizations. A personal account converted later would not do: UP Wallet cannot be
published under a personal account, and declaring the app otherwise to get through would be false.
(A plan with a personal account first was considered on 2026-10-21 and dropped for this reason.)

What the organization account needs:
1. **A registered business**, in whose name the account will be. Dun & Bradstreet also assigns
   D-U-N-S numbers to sole proprietorships registered with the Chamber of Commerce, so an existing
   registered activity of the maintainer may be enough, without waiting for a company; the account
   is then in that activity's name (README "Before a store release" lists adding the legal entity
   to the privacy policy).
2. **A D-U-N-S number** for it, from Dun & Bradstreet: free, but it can take up to about 28 days,
   so request it first. The name and address in the account must match the D-U-N-S record.
3. **The organization's website, verified in Google Search Console** (for example a DNS TXT record
   on chainintegrate.it), with the Google account that opens the Play Console.
4. **Official documents of the organization.** Accepted documents depend on the country; for Italy,
   check the list shown in the console (a Chamber of Commerce record, "visura camerale", is the likely
   equivalent).
5. **Contact e-mail and phone**, verified with one-time codes, the payments profile, and the
   25 USD fee once.

The Google account is ready: created on 2026-10-21 on ChainIntegrate's e-mail, with 2-step
verification. Keep its recovery options under the organization's control.

The closed test of about 12 testers for 14 days applies to new personal accounts; it is not expected
for an organization account (check the rule in the Play Console when the account is open).

Until the organization account exists, nothing changes for users: the APK installs from GitHub
releases as today, with Play Protect's scan. Google's enforcement for Italy is planned from 2027.

## Registering the app

- **Package name**: `it.chainintegrate.upwallet`.
- **Signing key**: the release key used by CI (repository secrets `UPW_KEYSTORE_B64`,
  `UPW_KEYSTORE_PASSWORD`, alias `upwallet`; its SHA-256 certificate fingerprint is printed by each
  CI run under "Signer of the APK"). Ownership is proved by giving the console an APK signed with
  this key, following the console's registration step. If the key were lost, the package name could
  not be registered: keep the offline copy (README "Signing").
- **Moving to Google Play later**: users who installed the APK must be able to update from Play.
  That needs the Play version signed with the same certificate: in Play App Signing, choose to use
  this existing key (upload it in the format the console asks for) instead of letting Google
  generate a new one. A new key would make Play's version a different app for Android, and users
  would have to uninstall (losing the app's data) to switch.

## Steps, in order

1. Google account on ChainIntegrate's e-mail, with 2-step verification (done, 2026-10-21).
2. The registered business (an existing registered activity, or a new company).
3. Request the D-U-N-S number (up to about 28 days).
4. Verify chainintegrate.it in Google Search Console with the same Google account.
5. Open the Play Console **organization** account (D-U-N-S, documents, contact codes, fee).
6. Register `it.chainintegrate.upwallet` with an APK signed with the release key.
7. For the Play listing (0.9.x): financial features and data safety forms (non-custodial wallet that keeps a key on the phone since 0.9.0),
   any test the console requires, Play App Signing with the existing key.

## Sources

- [Android developer verification](https://developer.android.com/developer-verification) (timeline,
  which console)
- [Guides](https://developer.android.com/developer-verification/guides) (steps for organizations,
  website verification, package registration)
- [Full distribution](https://developer.android.com/developer-verification/guides/full-distribution)
  (organization requirements: D-U-N-S, Search Console, documents, e-mail and phone)
- [FAQ](https://developer.android.com/developer-verification/guides/faq) (fee, D-U-N-S time, signing
  keys, Play Console as the single place)
- [Play Console requirements](https://support.google.com/googleplay/android-developer/answer/10788890)
  (point 1.1: financial products, cryptocurrency software wallets included, register as an
  organization)
