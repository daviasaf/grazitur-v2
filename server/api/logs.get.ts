import { readLogs } from '../utils/logs'

export default defineEventHandler(async () => {
  return await readLogs()
})
