import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Port 3000 is already allowed by the backend's default CLIENT_ORIGINS.
export default defineConfig({
  plugins: [react()],
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
