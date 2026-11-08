import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('maintenance', {
    status: () => ipcRenderer.invoke('maintenance:status'),
    recover: (password: string) => ipcRenderer.invoke('maintenance:recover', password),
    createBackup: () => ipcRenderer.invoke('maintenance:create-backup'),
    chooseBackup: () => ipcRenderer.invoke('maintenance:choose-backup'),
    restoreBackup: () => ipcRenderer.invoke('maintenance:restore-backup'),
});
