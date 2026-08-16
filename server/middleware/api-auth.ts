import { requireAdminSession } from '../utils/admin-auth'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return

  const method = getMethod(event)
  if (path === '/api/ping' || path === '/api/auth') return
  if (path === '/api/users' && method === 'POST') return
  if (/^\/api\/users\/\d+$/.test(path) && method === 'PUT') return
  if (path === '/api/passageiro/viagens') return
  if (path === '/api/passageiro/assinar' && method === 'POST') return
  if (/^\/api\/excursoes\/\d+\/espera$/.test(path) && method === 'POST') return
  if (path === '/api/excursoes' && method === 'GET' && String(getQuery(event).publico || '') === 'true') return

  event.context.admin = await requireAdminSession(event)
})
