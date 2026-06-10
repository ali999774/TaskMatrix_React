// Web Speech API capability check. Lives outside VoiceButton.tsx so
// component files only export components (react-refresh requirement),
// and so parents can hide surrounding UI (labels, nav slots) instead of
// rendering a labeled hole when VoiceButton returns null.
// Note: the API is often unavailable inside WKWebView (Capacitor iOS).
export function speechSupported(): boolean {
  if (typeof window === 'undefined') return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}
