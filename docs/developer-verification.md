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

## Which account: two phases

The app is meant for Google Play (0.9.0 candidate, 1.0.0 first public release, see README
"Versions"), so the account is a **Google Play Console** account: Google says it is the single
place to manage verification for apps distributed both on and outside Play. A separate Android
Developer Console account is only for developers who never publish on Play.

### Phase 1: personal account, in ChainIntegrate's name where possible

To start without waiting for a registered company and a D-U-N-S number:
- create the Google account on **ChainIntegrate's e-mail address** (a Google account can be made
  for an existing non-Gmail address, or through Google Workspace if the domain uses it), with 2-step
  verification and recovery options the organization controls;
- open a **personal** Play Console account with it: identity verified with the maintainer's own
  legal name, address and ID (they stay the account holder until phase 2), contact e-mail and phone
  verified with one-time codes, 25 USD fee once;
- set the public **developer name** to ChainIntegrate;
- for new personal accounts Google requires a **closed test** before production (about 12 testers
  for 14 days: check the current rule in the Play Console);
- check the Play Console's "Financial features" declaration: some financial app categories require
  an organization account; a non-custodial wallet like UP Wallet is expected not to, but confirm it
  there.

With the personal account verified, the developer is known to Google and Play Protect's warnings
for an unknown developer stop.

### Phase 2: convert to an organization account

When ChainIntegrate is a registered company (and before there is a market), the same account is
converted in place: Play Console → Developer account → About you, verify the organization's website,
then "Change account type" and set up the organization's payments profile. The app, its package
name, signing key, listing, reviews and users stay where they are. The change is one-way
(organization back to personal is not possible).

What the conversion needs (Google's organization requirements):
1. **A registered legal entity**, in whose name the account will be (README "Before a store
   release" already lists adding it to the privacy policy).
2. **A D-U-N-S number** for that entity, from Dun & Bradstreet: free, but it can take up to about
   28 days, so request it as soon as the entity exists. The name and address should match the
   D-U-N-S record.
3. **The organization's website, verified in Google Search Console** (for example a DNS TXT record
   on chainintegrate.it), with the same Google account.
4. **Official documents of the organization.** Accepted documents depend on the country; for Italy,
   check the list shown in the console (a Chamber of Commerce record, "visura camerale", is the likely
   equivalent).
5. **The organization's payments profile** and contact details.

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

Phase 1:
1. Create the Google account on ChainIntegrate's e-mail, with 2-step verification.
2. Open the personal Play Console account (identity, e-mail and phone codes, fee); developer name
   ChainIntegrate.
3. Register `it.chainintegrate.upwallet` with an APK signed with the release key.
4. For the Play listing (0.9.0): closed test as the console requires, financial features and data
   safety forms; Play App Signing with the existing key.

Phase 2, when the company exists:
1. Register ChainIntegrate as a legal entity.
2. Request the D-U-N-S number (up to about 28 days).
3. Verify chainintegrate.it in Google Search Console with the same Google account.
4. Convert the account: "Change account type", organization payments profile, documents.

## Sources

- [Android developer verification](https://developer.android.com/developer-verification) (timeline,
  which console)
- [Guides](https://developer.android.com/developer-verification/guides) (steps for organizations,
  website verification, package registration)
- [Full distribution](https://developer.android.com/developer-verification/guides/full-distribution)
  (organization requirements: D-U-N-S, Search Console, documents, e-mail and phone)
- [FAQ](https://developer.android.com/developer-verification/guides/faq) (fee, D-U-N-S time, signing
  keys, Play Console as the single place)
- [Play Console Help: change the account type](https://support.google.com/googleplay/android-developer/answer/16260648)
  (personal to organization in place, one-way)
