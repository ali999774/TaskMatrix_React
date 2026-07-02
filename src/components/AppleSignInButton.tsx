import { SignInWithApple } from '@capacitor-community/apple-sign-in'
import { supabase } from '../lib/supabase'
import { randomNonce, sha256Hex } from '../lib/apple-nonce'

interface AppleSignInButtonProps {
  onError: (message: string | null) => void
}

// Uses @capacitor-community/apple-sign-in rather than Supabase's web OAuth
// redirect (the mechanism signInWithGoogle in App.tsx uses): on a native iOS
// build, Apple requires the native ASAuthorizationController sheet, not a
// browser-based OAuth bounce — a web-style redirect flow does not satisfy
// Sign In with Apple's platform requirement when the app is a native wrapper.
// The plugin returns an identity token directly, which Supabase verifies via
// signInWithIdToken instead of signInWithOAuth. No deep-link/appUrlOpen round
// trip is involved. This button is gated behind Capacitor.isNativePlatform()
// by the caller since the native SDK path isn't available on web builds.
export default function AppleSignInButton({ onError }: AppleSignInButtonProps) {
  const signInWithApple = async () => {
    onError(null)

    const rawNonce = randomNonce()
    const hashedNonce = await sha256Hex(rawNonce)

    try {
      const result = await SignInWithApple.authorize({
        clientId: 'com.milestonepediatrics.taskmatrix', // App ID / bundle id
        redirectURI: 'taskmatrix-auth://callback', // required by the API but unused by the native flow
        scopes: 'name email',
        nonce: hashedNonce, // hashed -> Apple
      })

      const idToken = result.response?.identityToken
      if (!idToken) { onError('No identity token returned from Apple'); return }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: idToken,
        nonce: rawNonce, // raw -> Supabase
      })
      if (error) onError(error.message)
      // On success, the existing onAuthStateChange listener sets userId — no extra wiring.
    } catch (e) {
      // User-cancel comes back as a thrown error; swallow it quietly, surface real ones.
      const msg = (e as { message?: string })?.message ?? String(e)
      if (!/cancel/i.test(msg)) onError(msg)
    }
  }

  return (
    <button
      onClick={signInWithApple}
      className="flex items-center justify-center gap-2 bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity min-h-[44px]"
      aria-label="Sign in with Apple"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.38-2.85 1.4-2.92-.03-.01-2.69-1.03-2.72-4.07M14.53 4.5c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44" />
      </svg>
      Sign in with Apple
    </button>
  )
}
