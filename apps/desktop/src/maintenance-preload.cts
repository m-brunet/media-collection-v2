import { contextBridge, ipcRenderer } from 'electron';

// Set by the main process (`--mc-language=`), so the page follows the desktop language.
const language =
    process.argv.find((arg) => arg.startsWith('--mc-language='))?.split('=')[1] ?? 'en';

contextBridge.exposeInMainWorld('maintenance', {
    language,
    status: () => ipcRenderer.invoke('maintenance:status'),
    recover: (password: string) => ipcRenderer.invoke('maintenance:recover', password),
    createBackup: () => ipcRenderer.invoke('maintenance:create-backup'),
    chooseBackup: () => ipcRenderer.invoke('maintenance:choose-backup'),
    restoreBackup: () => ipcRenderer.invoke('maintenance:restore-backup'),
    openBackupFolder: () => ipcRenderer.invoke('maintenance:open-backup-folder'),
    openReleases: () => ipcRenderer.invoke('maintenance:open-releases'),
});
