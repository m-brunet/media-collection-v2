import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('administratorRecovery', {
    reset: (password: string): Promise<{ success: boolean; message: string }> =>
        ipcRenderer.invoke('administrator-recovery:reset', password),
});
