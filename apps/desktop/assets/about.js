const texts = {
    en: {
        windowTitle: 'About Media Collection',
        version: 'Version {version}',
        summary:
            'Catalogue your books, lend them and find them again, from this computer, a browser or a phone.',
        repository: 'Source code on GitHub',
        licence: 'MIT licence',
        credits: 'Credits and licences',
    },
    fr: {
        windowTitle: 'À propos de Media Collection',
        version: 'Version {version}',
        summary:
            'Cataloguez vos livres, prêtez-les et retrouvez-les, depuis cet ordinateur, un navigateur ou un téléphone.',
        repository: 'Code source sur GitHub',
        licence: 'Licence MIT',
        credits: 'Crédits et licences',
    },
};

class AboutPage {
    constructor(bridge) {
        this.bridge = bridge;
        this.language = bridge.language === 'fr' ? 'fr' : 'en';
    }

    start() {
        document.documentElement.lang = this.language;
        document.title = this.text('windowTitle');

        for (const element of document.querySelectorAll('[data-text]')) {
            element.textContent = this.text(element.dataset.text);
        }

        document.getElementById('version').textContent = this.text('version').replace(
            '{version}',
            this.bridge.version,
        );

        for (const element of document.querySelectorAll('[data-target]')) {
            element.addEventListener('click', (event) => {
                event.preventDefault();
                void this.bridge.open(element.dataset.target);
            });
        }
    }

    text(key) {
        return texts[this.language][key];
    }
}

new AboutPage(window.about).start();
