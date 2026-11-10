import { contextBridge, ipcRenderer } from 'electron';

// Set by the main process, so the page follows the desktop language and shows the running version.
const argument = (name: string) =>
    process.argv.find((arg) => arg.startsWith('--mc-' + name + '='))?.split('=')[1] ?? '';

contextBridge.exposeInMainWorld('about', {
    language: argument('language') || 'en',
    version: argument('version'),
    open: (target: 'repository' | 'licence' | 'credits') =>
        ipcRenderer.invoke('about:open', target),
});
