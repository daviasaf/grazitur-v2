export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig()

  const emailOk = !config.adminEmail || String(body.email || '').toLowerCase() === String(config.adminEmail).toLowerCase()
  const senhaOk = String(body.password || '') === String(config.adminPassword || '')

  if (emailOk && senhaOk) return { success: true }

  throw createError({ statusCode: 401, statusMessage: 'E-mail ou senha incorretos.' })
})
