export default defineNuxtConfig({
  ssr: true,
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'DevFlix | Software Engineer Portfolio',
      meta: [
        { name: 'description', content: 'A software engineer portfolio, told in episodes.' },
        { name: 'theme-color', content: '#090909' },
      ],
    },
  },
  compatibilityDate: '2026-08-25',
  devtools: { enabled: true },
})
