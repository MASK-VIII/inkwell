import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const desktop = process.env.INKWELL_DESKTOP === '1'

// https://vite.dev/config/
// Desktop (Electron production) loads from a custom origin (`inkwell://app/`) so asset
// URLs must be relative (`./`). Web builds keep `/` for normal hosting.
export default defineConfig({
  base: desktop ? './' : '/',
  plugins: [react(), tailwindcss()],
  // Use the same default host as `npm run dev` (localhost) so browser + Electron share one origin
  // (IndexedDB / localStorage). Binding only 127.0.0.1 would make `localhost:5173` a different site.
  ...(desktop ?
    {
      server: {
        port: 5173,
        strictPort: true,
      },
    }
  : {}),
})
