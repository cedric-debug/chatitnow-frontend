import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // This helps the AI library find the "buffer" package you just installed
      buffer: 'buffer',
    },
  },
  define: {
    // This tricks the library into thinking it has access to Node.js variables
    'global': 'window',
  },
})