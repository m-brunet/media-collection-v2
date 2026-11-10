const texts = {
    en: {
        windowTitle: 'Media Collection · Local maintenance',
        eyebrow: 'Local maintenance',
        title: 'Local maintenance',
        intro: 'The server is stopped while this window is open: browsers and phones cannot reach Media Collection. Close this window to start it again.',
        recoveryTitle: 'Recover Admin access',
        recoveryAccount:
            'Admin account: {name}. Set a new temporary password; it must be replaced at the next sign-in.',
        recoveryMissing: 'There is no Admin account yet.',
        newPassword: 'New temporary password',
        passwordHint: 'Use 8 to 128 characters.',
        repeatPassword: 'Repeat password',
        recoverButton: 'Reset password',
        recovered:
            'Password reset for {name}. Sign in with the temporary password, then choose a new one.',
        passwordsDiffer: 'The passwords must match.',
        backupTitle: 'Create a backup',
        backupIntro:
            'Saves all application data in one file: books and covers, collections, bookcases, tags, accounts and passwords, reading statuses, private notes, loans, history and settings.',
        backupPrivate: 'The file holds private notes and account data: keep it somewhere private.',
        backupButton: 'Create a backup…',
        openFolderButton: 'Open backup folder',
        failedUpdateTitle: 'After a failed update',
        failedUpdateIntro:
            'Before installing an update, Media Collection saves a full backup in the backup folder. If the new version does not start or your data looks wrong:',
        failedUpdateReinstall:
            'Download the version you had before from the releases page and install it.',
        failedUpdateOpen:
            'If Media Collection does not start, open this window with the Media Collection maintenance shortcut, or by starting Media Collection with --maintenance.',
        failedUpdateRestore:
            'Restore the backup made before the update: its name ends with “before” and the new version number.',
        releasesButton: 'Open the releases page',
        backedUp: 'Backup saved: {file}',
        restoreTitle: 'Restore a backup',
        restoreIntro:
            'Replaces all current data with a backup made by this version of Media Collection. The accounts and passwords of the backup apply, and everyone is signed out.',
        chooseButton: 'Choose a backup…',
        summaryFile: 'File',
        summaryDate: 'Created',
        summaryVersion: 'Version',
        summaryBooks: 'Books',
        summaryAccounts: 'Accounts',
        restoreConfirm: 'I understand the current data is replaced and everyone is signed out',
        restoreButton: 'Restore and end all sessions',
        restored:
            'Backup restored. Close this window to start Media Collection, then sign in with an account of the backup.',
        'administrator-missing': 'There is no Admin account yet.',
        'password-length': 'Use a password between 8 and 128 characters.',
        'backup-nothing': 'There is no application data to back up yet.',
        'backup-invalid': 'This file is not a Media Collection backup.',
        'backup-damaged':
            'This backup is damaged and cannot be restored. The current data is unchanged.',
        'backup-other-version':
            'This backup was made by Media Collection {backupVersion}. Only backups made by version {currentVersion} can be restored. The current data is unchanged.',
        failed: 'The operation failed: {message}',
    },
    fr: {
        windowTitle: 'Media Collection · Maintenance locale',
        eyebrow: 'Maintenance locale',
        title: 'Maintenance locale',
        intro: 'Le serveur est arrêté tant que cette fenêtre est ouverte : les navigateurs et les téléphones ne peuvent pas joindre Media Collection. Fermez cette fenêtre pour le redémarrer.',
        recoveryTitle: 'Récupérer l’accès Admin',
        recoveryAccount:
            'Compte Admin : {name}. Choisissez un nouveau mot de passe temporaire ; il devra être remplacé à la prochaine connexion.',
        recoveryMissing: 'Il n’y a pas encore de compte Admin.',
        newPassword: 'Nouveau mot de passe temporaire',
        passwordHint: 'De 8 à 128 caractères.',
        repeatPassword: 'Répéter le mot de passe',
        recoverButton: 'Réinitialiser le mot de passe',
        recovered:
            'Mot de passe réinitialisé pour {name}. Connectez-vous avec le mot de passe temporaire, puis choisissez-en un nouveau.',
        passwordsDiffer: 'Les mots de passe doivent être identiques.',
        backupTitle: 'Créer une sauvegarde',
        backupIntro:
            'Enregistre toutes les données dans un fichier : livres et couvertures, collections, bibliothèques, étiquettes, comptes et mots de passe, statuts de lecture, notes privées, prêts, historique et réglages.',
        backupPrivate:
            'Le fichier contient des notes privées et les données des comptes : gardez-le en lieu sûr.',
        backupButton: 'Créer une sauvegarde…',
        openFolderButton: 'Ouvrir le dossier des sauvegardes',
        failedUpdateTitle: 'Après une mise à jour qui a échoué',
        failedUpdateIntro:
            'Avant d’installer une mise à jour, Media Collection enregistre une sauvegarde complète dans le dossier des sauvegardes. Si la nouvelle version ne démarre pas ou si vos données semblent incorrectes :',
        failedUpdateReinstall:
            'Téléchargez la version que vous aviez avant depuis la page des versions et installez-la.',
        failedUpdateOpen:
            'Si Media Collection ne démarre pas, ouvrez cette fenêtre avec le raccourci Media Collection maintenance, ou en lançant Media Collection avec --maintenance.',
        failedUpdateRestore:
            'Restaurez la sauvegarde faite avant la mise à jour : son nom se termine par « before » et le numéro de la nouvelle version.',
        releasesButton: 'Ouvrir la page des versions',
        backedUp: 'Sauvegarde enregistrée : {file}',
        restoreTitle: 'Restaurer une sauvegarde',
        restoreIntro:
            'Remplace toutes les données actuelles par une sauvegarde faite avec cette version de Media Collection. Les comptes et mots de passe de la sauvegarde s’appliquent et tout le monde est déconnecté.',
        chooseButton: 'Choisir une sauvegarde…',
        summaryFile: 'Fichier',
        summaryDate: 'Créée le',
        summaryVersion: 'Version',
        summaryBooks: 'Livres',
        summaryAccounts: 'Comptes',
        restoreConfirm:
            'Je comprends que les données actuelles sont remplacées et que tout le monde est déconnecté',
        restoreButton: 'Restaurer et fermer toutes les sessions',
        restored:
            'Sauvegarde restaurée. Fermez cette fenêtre pour démarrer Media Collection, puis connectez-vous avec un compte de la sauvegarde.',
        'administrator-missing': 'Il n’y a pas encore de compte Admin.',
        'password-length': 'Choisissez un mot de passe de 8 à 128 caractères.',
        'backup-nothing': 'Il n’y a pas encore de données à sauvegarder.',
        'backup-invalid': 'Ce fichier n’est pas une sauvegarde Media Collection.',
        'backup-damaged':
            'Cette sauvegarde est endommagée et ne peut pas être restaurée. Les données actuelles sont inchangées.',
        'backup-other-version':
            'Cette sauvegarde a été faite avec Media Collection {backupVersion}. Seules les sauvegardes de la version {currentVersion} peuvent être restaurées. Les données actuelles sont inchangées.',
        failed: 'L’opération a échoué : {message}',
    },
};

class MaintenancePage {
    constructor(bridge) {
        this.bridge = bridge;
        this.language = bridge.language === 'fr' ? 'fr' : 'en';
        this.administrator = null;
        this.chosen = null;
    }

    async start() {
        this.element('language').value = this.language;
        this.element('language').addEventListener('change', (event) => {
            this.language = event.target.value;
            this.render();
        });
        this.element('recovery-form').addEventListener('submit', (event) => {
            event.preventDefault();
            void this.recover();
        });
        this.element('create-backup').addEventListener('click', () => void this.createBackup());
        this.element('open-backup-folder').addEventListener('click', () => void this.openFolder());
        this.element('open-releases').addEventListener('click', () => void this.openReleases());
        this.element('choose-backup').addEventListener('click', () => void this.chooseBackup());
        this.element('restore-confirm').addEventListener('change', () =>
            this.updateRestoreButton(),
        );
        this.element('restore-backup').addEventListener('click', () => void this.restoreBackup());
        await this.refresh();
    }

    async refresh() {
        const status = await this.bridge.status();

        this.administrator = status.success ? status.value.administrator : null;
        this.hasData = status.success && status.value.hasData;
        this.render();
    }

    render() {
        document.documentElement.lang = this.language;
        document.title = this.text('windowTitle');

        for (const element of document.querySelectorAll('[data-text]')) {
            element.textContent = this.text(element.dataset.text);
        }

        this.element('recovery-account').textContent = this.administrator
            ? this.text('recoveryAccount', { name: this.administrator })
            : this.text('recoveryMissing');
        this.element('recovery-form').hidden = !this.administrator;
        this.element('create-backup').disabled = !this.hasData;

        if (this.chosen) {
            this.showSummary(this.chosen);
        }
    }

    async recover() {
        const password = this.element('password');
        const confirmation = this.element('confirmation');

        if (password.value !== confirmation.value) {
            this.say('recovery-result', this.text('passwordsDiffer'));

            return;
        }

        const result = await this.busy('recovery-form', () => this.bridge.recover(password.value));

        password.value = '';
        confirmation.value = '';
        this.say(
            'recovery-result',
            result.success
                ? this.text('recovered', { name: result.value.username })
                : this.failure(result),
        );
    }

    async createBackup() {
        const result = await this.busy('create-backup', () => this.bridge.createBackup());

        if (result.success || result.reason !== 'cancelled') {
            this.say(
                'backup-result',
                result.success
                    ? this.text('backedUp', { file: result.value.file })
                    : this.failure(result),
            );
        }
    }

    async openFolder() {
        const result = await this.busy('open-backup-folder', () => this.bridge.openBackupFolder());

        this.say('backup-result', result.success ? '' : this.failure(result));
    }

    async openReleases() {
        const result = await this.busy('open-releases', () => this.bridge.openReleases());

        this.say('failed-update-result', result.success ? '' : this.failure(result));
    }

    async chooseBackup() {
        const result = await this.busy('choose-backup', () => this.bridge.chooseBackup());

        if (!result.success && result.reason === 'cancelled') {
            return;
        }

        this.chosen = result.success ? result.value : null;
        this.element('restore-choice').hidden = !this.chosen;
        this.element('restore-confirm').checked = false;
        this.updateRestoreButton();
        this.say('restore-result', result.success ? '' : this.failure(result));

        if (this.chosen) {
            this.showSummary(this.chosen);
        }
    }

    async restoreBackup() {
        const result = await this.busy('restore-backup', () => this.bridge.restoreBackup());

        this.chosen = null;
        this.element('restore-choice').hidden = true;
        this.say('restore-result', result.success ? this.text('restored') : this.failure(result));
        await this.refresh();
    }

    showSummary(choice) {
        const formatter = new Intl.DateTimeFormat(this.language, {
            dateStyle: 'long',
            timeStyle: 'short',
        });

        this.element('summary-file').textContent = choice.file;
        this.element('summary-date').textContent = formatter.format(
            new Date(choice.backup.createdAt),
        );
        this.element('summary-version').textContent = choice.backup.version;
        this.element('summary-books').textContent = String(choice.backup.contents.books);
        this.element('summary-accounts').textContent = String(choice.backup.contents.accounts);
    }

    updateRestoreButton() {
        this.element('restore-backup').disabled = !this.element('restore-confirm').checked;
    }

    async busy(id, work) {
        const element = this.element(id);
        const controls = element.matches('form') ? element.querySelectorAll('button') : [element];

        for (const control of controls) {
            control.disabled = true;
        }

        try {
            return await work();
        } finally {
            for (const control of controls) {
                control.disabled = false;
            }

            this.render();
            this.updateRestoreButton();
        }
    }

    failure(result) {
        if (result.reason && texts[this.language][result.reason]) {
            return this.text(result.reason, result.details ?? {});
        }

        return this.text('failed', { message: result.message });
    }

    text(key, values = {}) {
        return texts[this.language][key].replace(/\{(\w+)\}/g, (_, name) => String(values[name]));
    }

    say(id, message) {
        this.element(id).textContent = message;
    }

    element(id) {
        return document.getElementById(id);
    }
}

void new MaintenancePage(window.maintenance).start();
