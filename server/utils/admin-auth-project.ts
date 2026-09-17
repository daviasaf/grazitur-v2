// The portal and GraziTur have different accounts even when an email matches.
// Supabase Auth is shared by every application using the same project.
const PORTAL_PROJECT_REF = 'xgrcwdtkalelegoysxbw'

function projectRefFromDatabaseUrl(value: string) {
  if (!value) return null
  try {
    const url = new URL(value)
    const poolerRef = /^postgres\.([a-z0-9]+)$/.exec(decodeURIComponent(url.username))?.[1]
    const directRef = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname)?.[1]
    return poolerRef || directRef || null
  } catch {
    return null
  }
}

export function assertIsolatedAdminAuthProject(authUrl: string, databaseUrl: string, directUrl: string) {
  let authRef: string | undefined
  try {
    authRef = /^([a-z0-9]+)\.supabase\.co$/.exec(new URL(authUrl).hostname)?.[1]
  } catch {
    // Reject malformed project URLs below, without falling back to shared auth.
  }
  const databaseRef = projectRefFromDatabaseUrl(databaseUrl) || projectRefFromDatabaseUrl(directUrl)
  if (!authRef || !databaseRef || authRef === PORTAL_PROJECT_REF || authRef === databaseRef) {
    throw new Error('A autenticação administrativa deve usar um projeto Supabase próprio, separado do banco e do Portal Águia.')
  }
}
