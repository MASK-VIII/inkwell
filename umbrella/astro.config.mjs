import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://enterthelimelight.com',
  trailingSlash: 'never',
  build: {
    assets: 'assets',
  },
})
