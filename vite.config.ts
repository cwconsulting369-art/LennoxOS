import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:4000' },
    port: 3000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    preserveSymlinks: true,
    dedupe: ['react', 'react-dom', 'lucide-react', 'recharts'],
  },
  optimizeDeps: {
    include: ['lucide-react', 'clsx', 'tailwind-merge', 'recharts'],
  },
});
