import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'

const APP_VERSION = Date.now().toString(36)

// Write version.json to public/ at build time so the deployed app
// can compare its baked-in version against the latest deploy.
function versionPlugin() {
  return {
    name: 'glazepro-version',
    buildStart() {
      writeFileSync('public/version.json', JSON.stringify({ v: APP_VERSION }) + '\n')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
})
