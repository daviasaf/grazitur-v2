// GraziTur must never change a Portal Águia password through shared Supabase Auth.
export function usesSharedPortalAuth(authUrl: string) {
  try {
    return new URL(authUrl).hostname === 'xgrcwdtkalelegoysxbw.supabase.co'
  } catch {
    return true
  }
}
