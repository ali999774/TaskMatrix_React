# Spec — Sign in with Apple (Item 4)

**Route:** Decision made here; **implementation handed off as a spec** (not coded).
**Why spec, not implement:** the work is ~50% Apple Developer portal + Xcode
capability + Supabase dashboard config that cannot be done from this environment,
and the code path cannot be verified without a real native build signed with an
Apple account. The remaining code is exact and drop-in (below). Half-wiring the
button without the portal config would ship a button that errors, which is worse
than a precise spec.

---

## The 4.8 finding (decides "should we")

Current App Store Review Guidelines, **Guideline 4.8 – Login Services**, verbatim:

> Apps that use a third-party or social login service (such as Facebook Login,
> Google Sign-In, Log in with X, Sign In with LinkedIn, Login with Amazon, or
> WeChat Login) to set up or authenticate the user's primary account with the app
> **must also offer as an equivalent option another login service** with the
> following features:
> - the login service limits data collection to the user's name and email address;
> - the login service allows users to keep their email address private as part of
>   setting up their account; and
> - the login service does not collect interactions with your app for advertising
>   purposes without consent.

TaskMatrix authenticates the user's primary account with **Google Sign-In**
(`App.tsx` `signInWithGoogle`). None of the exemptions apply (it is not a
first-party-only system, not an alternative marketplace, not an
enterprise/education-account app, not a citizen-ID system, not a single-service
client). Therefore an equivalent privacy-focused login **is required**.

**Sign in with Apple** satisfies all three bullets (name+email only, Hide My
Email, no ad tracking). 

### Decision: **Add Sign in with Apple. It is mandatory, not optional.**

This is a compliance blocker for App Store approval the moment the app is
submitted with Google sign-in present. The "should we" question is settled by the
guideline; no product judgment needed.

Source: <https://developer.apple.com/app-store/review/guidelines/> (§4.8).

---

## Approach decision: native ASAuthorization + `signInWithIdToken`

Two valid flows exist. For a **native iOS Capacitor build**, use the native one.

| Flow | Use? | Why |
|---|---|---|
| **Native `@capacitor-community/apple-sign-in` → `supabase.auth.signInWithIdToken`** | ✅ Primary | Uses Apple's native `ASAuthorizationController` sheet (Face ID, no browser bounce). Returns an identity-token JWT + nonce that Supabase verifies directly. This is the experience Apple expects on-device and the path that reviewers see. |
| Supabase web OAuth (`signInWithOAuth({ provider: 'apple' })` + Capacitor `Browser`) | ⚠️ Fallback only | Same browser-redirect mechanics as the current Google flow. Works, but bounces out to a web page — worse UX, and pulls in the Services ID / return-URL web config unnecessarily for a native-only app. Keep as a documented fallback if the native plugin ever fails to build. |

The existing Google flow stays exactly as it is (web OAuth via `Browser`). Apple
gets the native treatment.

---

## Config that only the account owner can do (do these FIRST)

The bundle ID is **`com.milestonepediatrics.taskmatrix`** (from
`capacitor.config.ts` / `project.pbxproj`).

### 1. Apple Developer portal
- **Certificates, Identifiers & Profiles → Identifiers →** the App ID
  `com.milestonepediatrics.taskmatrix` → enable the **Sign In with Apple**
  capability. Save.
- (Only if you ever add the *web* fallback flow: create a **Services ID**, enable
  Sign in with Apple on it, set the return URL to the Supabase callback. Not
  needed for the native flow below.)

### 2. Xcode
- Open `ios/App/App.xcworkspace` → target **App → Signing & Capabilities → +
  Capability → Sign in with Apple**. This creates/updates
  `ios/App/App/App.entitlements` with:
  ```xml
  <key>com.apple.developer.applesignin</key>
  <array><string>Default</string></array>
  ```
  Commit that entitlements file (the repo currently has **no** `.entitlements`).

### 3. Supabase dashboard
- **Authentication → Providers → Apple → Enable.**
- Under **Authorized Client IDs**, add the bundle ID
  `com.milestonepediatrics.taskmatrix`. For the **native** `signInWithIdToken`
  flow, this client-ID allow-list is the part that matters — Supabase validates
  that the identity token's `aud` is in this list.
- (Secret key / Services ID / Team ID under "Apple" are only required for the web
  OAuth flow and token refresh. Native token verification works with the client
  ID allow-list. Add them only if you adopt the web fallback.)

---

## Code (drop-in, exact)

### 1. Plugin
```bash
npm install @capacitor-community/apple-sign-in
npx cap sync ios
```
Add to `package.json` dependencies (version pin to the Capacitor 8-compatible
release; verify `npm view @capacitor-community/apple-sign-in version` resolves a
v8.x line to match the other `@capacitor/*` ^8 packages).

### 2. Nonce helpers — `src/lib/apple-nonce.ts` (new)
Apple wants the **SHA-256 hash** of the nonce in the request; Supabase wants the
**raw** nonce to verify. Mismatching these is the #1 cause of silent failures.

```ts
// Generate a random nonce and its SHA-256 hex digest.
export function randomNonce(length = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values, (v) => charset[v % charset.length]).join('')
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
```

### 3. `signInWithApple` in `App.tsx`
Place beside `signInWithGoogle`. Mirrors its error handling
(`setAuthError`) and native gating.

```ts
import { SignInWithApple } from '@capacitor-community/apple-sign-in'
import { randomNonce, sha256Hex } from './lib/apple-nonce'

const signInWithApple = async () => {
  setAuthError(null)
  if (!Capacitor.isNativePlatform()) return // native-only; web is out of scope (held)

  const rawNonce = randomNonce()
  const hashedNonce = await sha256Hex(rawNonce)

  try {
    const result = await SignInWithApple.authorize({
      clientId: 'com.milestonepediatrics.taskmatrix', // App ID / bundle id
      redirectURI: 'taskmatrix-auth://callback',       // reuses the existing scheme
      scopes: 'name email',
      nonce: hashedNonce,                               // hashed → Apple
    })

    const idToken = result.response?.identityToken
    if (!idToken) { setAuthError('No identity token returned from Apple'); return }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: idToken,
      nonce: rawNonce,                                  // raw → Supabase
    })
    if (error) setAuthError(error.message)
    // On success, the existing onAuthStateChange listener sets userId — no extra wiring.
  } catch (e) {
    // User-cancel comes back as a thrown error; swallow it quietly, surface real ones.
    const msg = (e as { message?: string })?.message ?? String(e)
    if (!/cancel/i.test(msg)) setAuthError(msg)
  }
}
```

Notes:
- **No deep-link handling needed.** Unlike the Google `Browser` flow, the native
  Apple sheet returns the token in-process; the `appUrlOpen` listener in `App.tsx`
  is not involved. `redirectURI` is required by the API but the native flow does
  not actually round-trip through it.
- Apple returns the user's name **only on first authorization**. If you ever want
  to capture a display name, read `result.response.givenName/familyName` here on
  first sign-in (TaskMatrix currently stores no profile name, so this is optional).

### 4. Sign-in screen button — `App.tsx` (the `if (!userId)` block)
Add **below** the Google button, gated to native iOS. Follow Apple HIG: full-width,
black (white in dark mode), Apple logo, exact label "Sign in with Apple".

```tsx
{Capacitor.getPlatform() === 'ios' && (
  <button
    onClick={signInWithApple}
    className="flex items-center justify-center gap-2 bg-black dark:bg-white
      text-white dark:text-black px-6 py-3 rounded-lg font-medium
      hover:opacity-90 transition-opacity min-h-[44px] w-[260px] max-w-full"
    aria-label="Sign in with Apple"
  >
    {/* Apple logo glyph */}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.38-2.85 1.4-2.92-.03-.01-2.69-1.03-2.72-4.07M14.53 4.5c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44"/>
    </svg>
    Sign in with Apple
  </button>
)}
```

(`Capacitor.getPlatform() === 'ios'` — show on iOS only. The web build is HELD /
out of scope, so no web Apple button.)

---

## Test plan (requires a real device/Simulator + signed build)
1. Portal + Xcode + Supabase config done; `npx cap sync ios`.
2. Run on a Simulator/device signed into an Apple ID.
3. Tap **Sign in with Apple** → native sheet → Face ID / password → app lands
   authenticated; a row appears in Supabase `auth.users` with `provider: apple`.
4. Choose **Hide My Email** → confirm a `privaterelay.appleid.com` address is
   stored (proves 4.8 privacy requirement is satisfied).
5. Cancel the sheet → no error toast (cancel is swallowed).
6. Existing Google sign-in still works unchanged.

## Acceptance
- [ ] `Sign in with Apple` capability + entitlements committed.
- [ ] Supabase Apple provider enabled with the bundle ID in Authorized Client IDs.
- [ ] Native sheet completes a round-trip to an authenticated Supabase session.
- [ ] Hide My Email works.
- [ ] Button matches Apple HIG (placement, colour, label, logo).
- [ ] Google flow untouched.
