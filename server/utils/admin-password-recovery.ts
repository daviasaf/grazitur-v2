export function buildAdminPasswordRecoveryRequest(email: string, redirectTo: string) {
  const query = new URLSearchParams({ redirect_to: redirectTo })
  return {
    path: `/recover?${query.toString()}`,
    body: JSON.stringify({ email })
  }
}
