import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    root: 'apps/web',
    plugins: [ react() ],
    build: { outDir: '../../dist/apps/web', emptyOutDir: true },
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
        proxy: {
            '/api': {
                // tools/dev.mjs follows Electron's actual backend readiness port.
                target: 'http://127.0.0.1:3000',
                changeOrigin: false
            },
        },
    },
});
