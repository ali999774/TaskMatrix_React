// Apple wants the SHA-256 hash of the nonce in the authorization request;
// Supabase wants the raw nonce to verify the identity token. Mismatching
// these is the #1 cause of silent Sign in with Apple failures.
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
