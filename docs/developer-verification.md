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

## Which account

The account will be an **organization** account for ChainIntegrate, created with ChainIntegrate's
own e-mail address, not a personal one. Since the app is meant for Google Play (0.9.0 candidate,
1.0.0 first public release, see README "Versions"), the account to open is a **Google Play
Console** organization account: Google says it is the single place to manage verification for apps
distributed both on and outside Play. A separate Android Developer Console account is only for
developers who never publish on Play.

What an organization needs (Google's "Full distribution" requirements):
1. **A registered legal entity.** The organization account is in the name of the entity. If
   ChainIntegrate is not yet registered as a company, this comes first (README "Before a store
   release" already lists adding the legal entity to the privacy policy).
2. **A D-U-N-S number** for that entity, from Dun & Bradstreet. It is free but can take up to
   about 28 days: request it as soon as the entity exists. The organization's name and address in
   the account should match the D-U-N-S record.
3. **The organization's website, verified in Google Search Console** (for example a DNS TXT record
   on the domain chainintegrate.it). The Search Console property should be owned by the same
   Google account used for the developer account.
4. **Official documents of the organization.** Google lists US examples; the accepted documents
   depend on the country. For Italy, check the list shown in the console (a Chamber of Commerce
   company record, "visura camerale", is the likely equivalent).
5. **A private contact e-mail and phone number**, each verified with a one-time code. Use
   ChainIntegrate's e-mail and a phone the organization controls.
6. **The registration fee**: 25 USD, once.

The Google account itself: create it on ChainIntegrate's e-mail address (a Google account can be
made for an existing non-Gmail address, or through Google Workspace if the domain uses it). Keep its
recovery options and 2-step verification under the organization's control, not tied to one
person's phone.

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

## Closed test for the Play listing

The rule of about 12 testers for 14 days before production applies to new **personal** Play
developer accounts. It is not expected for an organization account; check the current rule in the
Play Console when the account is opened, and update README "Versions" (1.0.0, point 1) accordingly.

## Steps, in order

1. Register ChainIntegrate as a legal entity, if not done yet.
2. Request the D-U-N-S number (up to about 28 days).
3. Create the Google account on ChainIntegrate's e-mail, with 2-step verification.
4. Verify chainintegrate.it in Google Search Console with that account.
5. Open the Play Console organization account (D-U-N-S, documents, e-mail and phone codes, fee).
6. Register `it.chainintegrate.upwallet` with an APK signed with the release key.
7. When the app goes to Play: Play App Signing with the existing key.

## Sources

- [Android developer verification](https://developer.android.com/developer-verification) (timeline,
  which console)
- [Guides](https://developer.android.com/developer-verification/guides) (steps for organizations,
  website verification, package registration)
- [Full distribution](https://developer.android.com/developer-verification/guides/full-distribution)
  (organization requirements: D-U-N-S, Search Console, documents, e-mail and phone)
- [FAQ](https://developer.android.com/developer-verification/guides/faq) (fee, D-U-N-S time, signing
  keys, Play Console as the single place)
