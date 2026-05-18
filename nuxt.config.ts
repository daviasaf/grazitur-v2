export default defineNuxtConfig({
  compatibilityDate: "2024-04-03",
  devtools: { enabled: true },
  css: ["bootstrap/dist/css/bootstrap.min.css", "~/assets/css/main.css"],
  app: {
    head: {
      title: "GraziTur",
      meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.ico" }]
    }
  },
  runtimeConfig: {
    adminEmail: process.env.ADMIN_EMAIL || "admin@grazitur.com",
    adminPassword: process.env.ADMIN_PASSWORD || "123456"
  }
})
