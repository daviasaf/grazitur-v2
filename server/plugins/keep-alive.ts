const FIVE_MINUTES = 300000

declare global {
  var __graziKeepAliveTimer: NodeJS.Timeout | undefined
}

export default defineNitroPlugin(() => {
  const keepAliveUrl = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL

  if (!keepAliveUrl || globalThis.__graziKeepAliveTimer) {
    return
  }

  globalThis.__graziKeepAliveTimer = setInterval(() => {
    fetch(keepAliveUrl)
      .then(() => console.log("Ping enviado!"))
      .catch((err) => console.error("Erro ao pingar:", err))
  }, FIVE_MINUTES)

  globalThis.__graziKeepAliveTimer.unref?.()
})
