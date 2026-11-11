import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

function leafFallback(): Plugin {
    return {
        name: 'media-collection-leaf-fallback',
        configureServer(server) {
            server.middlewares.use((request, _response, next) => {
                const path = request.url?.split('?')[0] ?? '';

                if (
                    request.method === 'GET' &&
                    (path === '/leaf' || path.startsWith('/leaf/')) &&
                    !path.slice('/leaf/'.length).includes('.')
                ) {
                    request.url = '/leaf/index.html';
                }

                next();
            });
        },
    };
}

export default defineConfig({
    root: 'apps/web',
    plugins: [react(), leafFallback()],
    build: {
        outDir: '../../dist/apps/web',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                libris: resolve(import.meta.dirname, 'apps/web/index.html'),
                leaf: resolve(import.meta.dirname, 'apps/web/leaf/index.html'),
            },
        },
    },
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:34345',
                changeOrigin: false,
            },
        },
    },
});
