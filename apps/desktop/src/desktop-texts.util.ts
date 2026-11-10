import type { DesktopLanguageCode } from './desktop-language.util.js';

const english = {
    invalidConfigurationTitle: 'Invalid application configuration',
    configurationFailed: 'Configuration failed.',
    startFailedTitle: 'Application could not start',
    unknownStartupError: 'Unknown startup error.',
    unsavedTitle: 'Unsaved changes',
    unsavedMessage: 'Leave without saving?',
    unsavedDetail: 'The changes you made on this page will be lost.',
    unsavedLeave: 'Leave without saving',
    unsavedStay: 'Stay',
    serverStoppedTitle: 'Server stopped',
    serverStoppedMessage: 'The application server stopped. Retry to start it again.',
    serverStartTitle: 'Server could not start',
    serverStartFallback: 'The server failed to start.',
    serverStartDetail: 'Check the configured port and data directory, then retry.',
    retry: 'Retry',
    quit: 'Quit',
    cancel: 'Cancel',
    maintenanceTitle: 'Local maintenance',
    maintenanceMessage: 'Open local maintenance?',
    maintenanceDetail:
        'The server stops while maintenance is open: browsers and phones lose access until you close it. Unsaved changes in this window are lost.',
    maintenanceConfirm: 'Stop the server and open maintenance',
    maintenanceWindowTitle: 'Media Collection · Local maintenance',
    createBackupTitle: 'Create a backup',
    restoreBackupTitle: 'Restore a backup',
    backupFileType: 'Media Collection backup',
    maintenanceFailed: 'Maintenance failed.',
    menuFile: 'File',
    menuView: 'View',
    menuMaintenance: 'Maintenance',
    menuOpenMaintenance: 'Open local maintenance…',
    menuExit: 'Exit',
    menuReload: 'Reload',
    menuForceReload: 'Force reload',
    menuDeveloperTools: 'Toggle developer tools',
    menuActualSize: 'Actual size',
    menuZoomIn: 'Zoom in',
    menuZoomOut: 'Zoom out',
    menuFullScreen: 'Toggle full screen',
};

export type DesktopTextKey = keyof typeof english;

const french: Record<DesktopTextKey, string> = {
    invalidConfigurationTitle: 'Configuration de l’application invalide',
    configurationFailed: 'La configuration a échoué.',
    startFailedTitle: 'L’application n’a pas pu démarrer',
    unknownStartupError: 'Erreur de démarrage inconnue.',
    unsavedTitle: 'Modifications non enregistrées',
    unsavedMessage: 'Quitter sans enregistrer ?',
    unsavedDetail: 'Les modifications faites sur cette page seront perdues.',
    unsavedLeave: 'Quitter sans enregistrer',
    unsavedStay: 'Rester',
    serverStoppedTitle: 'Serveur arrêté',
    serverStoppedMessage: 'Le serveur de l’application s’est arrêté. Réessayez pour le redémarrer.',
    serverStartTitle: 'Le serveur n’a pas pu démarrer',
    serverStartFallback: 'Le serveur n’a pas pu démarrer.',
    serverStartDetail: 'Vérifiez le port et le dossier de données configurés, puis réessayez.',
    retry: 'Réessayer',
    quit: 'Quitter',
    cancel: 'Annuler',
    maintenanceTitle: 'Maintenance locale',
    maintenanceMessage: 'Ouvrir la maintenance locale ?',
    maintenanceDetail:
        'Le serveur s’arrête pendant la maintenance : les navigateurs et les téléphones perdent l’accès jusqu’à sa fermeture. Les modifications non enregistrées de cette fenêtre sont perdues.',
    maintenanceConfirm: 'Arrêter le serveur et ouvrir la maintenance',
    maintenanceWindowTitle: 'Media Collection · Maintenance locale',
    createBackupTitle: 'Créer une sauvegarde',
    restoreBackupTitle: 'Restaurer une sauvegarde',
    backupFileType: 'Sauvegarde Media Collection',
    maintenanceFailed: 'La maintenance a échoué.',
    menuFile: 'Fichier',
    menuView: 'Affichage',
    menuMaintenance: 'Maintenance',
    menuOpenMaintenance: 'Ouvrir la maintenance locale…',
    menuExit: 'Quitter',
    menuReload: 'Actualiser',
    menuForceReload: 'Forcer l’actualisation',
    menuDeveloperTools: 'Outils de développement',
    menuActualSize: 'Taille réelle',
    menuZoomIn: 'Zoom avant',
    menuZoomOut: 'Zoom arrière',
    menuFullScreen: 'Plein écran',
};

// Every text drawn by the Electron main process: dialogs, menus and window titles.
export class DesktopTexts {
    static readonly catalogue: Readonly<
        Record<DesktopLanguageCode, Readonly<Record<DesktopTextKey, string>>>
    > = { en: english, fr: french };

    constructor(readonly language: DesktopLanguageCode) {}

    text(key: DesktopTextKey): string {
        return DesktopTexts.catalogue[this.language][key];
    }
}
