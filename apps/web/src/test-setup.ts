import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { IconArtwork } from './shared/ui/icon-artwork.util';

afterEach(() => {
    cleanup();
    window.localStorage.clear();
});

// jsdom has no <dialog> modal support; emulate the open state the browser would manage.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
};

afterEach(() => {
    delete document.documentElement.dataset.colorScheme;
});

// Component tests have no server: the icon sets come straight from the app's static files.
const iconSets = import.meta.glob<Record<string, string>>('../public/icon-sets/*.json', {
    eager: true,
    import: 'default',
});

IconArtwork.source = async (set) => {
    const artwork = iconSets['../public/icon-sets/' + set + '.json'];

    if (!artwork) {
        throw new Error('Unknown icon set ' + set + '.');
    }

    return artwork;
};
