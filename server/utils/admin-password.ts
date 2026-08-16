export const ADMIN_PASSWORD_MIN_LENGTH = 12
export const ADMIN_PASSWORD_MAX_LENGTH = 128

export function validateAdminPassword(password: string) {
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    return `A senha precisa ter pelo menos ${ADMIN_PASSWORD_MIN_LENGTH} caracteres.`
  }
  if (password.length > ADMIN_PASSWORD_MAX_LENGTH) {
    return `A senha pode ter no máximo ${ADMIN_PASSWORD_MAX_LENGTH} caracteres.`
  }

  const groups = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length

  if (groups < 3) {
    return 'Use pelo menos três tipos: letra minúscula, maiúscula, número e símbolo.'
  }

  return null
}
