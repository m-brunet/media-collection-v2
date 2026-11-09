import type { MessageKey } from '../i18n/catalog-en';

export interface Credit {
    id: string;
    // Proper names, shown as written in every language.
    name: string;
    author: string;
    url: string;
    licence: string;
    licenceUrl: string | null;
    used: MessageKey;
    // How the work was changed for Media Collection; null when used as published.
    changes: MessageKey | null;
}

export interface CreditGroup {
    title: MessageKey;
    credits: Credit[];
}

const ccBy3 = 'https://creativecommons.org/licenses/by/3.0/';
const ccBy4 = 'https://creativecommons.org/licenses/by/4.0/';
const ofl = 'https://openfontlicense.org/';
const mit = 'https://opensource.org/license/mit';
const apache = 'https://www.apache.org/licenses/LICENSE-2.0';
const streamline = 'Streamline (streamlinehq.com)';

// Every bundled icon pack, font, data source and library that needs credit (KI-6; lists from
// Tasks 6, 7 and 9.5, the icon library's CREDITS.md and apps/desktop/assets/icons/CREDITS.md).
export class Credits {
    static readonly groups: readonly CreditGroup[] = [
        {
            title: 'credits.group.icons',
            credits: [
                {
                    id: 'lucide',
                    name: 'Lucide',
                    author: 'Lucide contributors; portions by Cole Bemis (Feather)',
                    url: 'https://lucide.dev',
                    licence: 'ISC',
                    licenceUrl: 'https://lucide.dev/license',
                    used: 'credits.lucide.used',
                    changes: null,
                },
                {
                    id: 'game-icons',
                    name: 'Game Icons',
                    author: 'GameIcons contributors',
                    url: 'https://game-icons.net',
                    licence: 'CC BY 3.0',
                    licenceUrl: ccBy3,
                    used: 'credits.gameIcons.used',
                    changes: 'credits.iconSet.changes',
                },
                {
                    id: 'streamline-freehand',
                    name: 'Streamline Freehand',
                    author: streamline,
                    url: 'https://github.com/webalys-hq/streamline-vectors',
                    licence: 'CC BY 4.0',
                    licenceUrl: ccBy4,
                    used: 'credits.streamlineFreehand.used',
                    changes: 'credits.iconSet.changes',
                },
                {
                    id: 'streamline-cyber',
                    name: 'Streamline Cyber',
                    author: streamline,
                    url: 'https://github.com/webalys-hq/streamline-vectors',
                    licence: 'CC BY 4.0',
                    licenceUrl: ccBy4,
                    used: 'credits.streamlineCyber.used',
                    changes: 'credits.streamlineCyber.changes',
                },
                {
                    id: 'streamline-ultimate',
                    name: 'Streamline Ultimate',
                    author: streamline,
                    url: 'https://github.com/webalys-hq/streamline-vectors',
                    licence: 'CC BY 4.0',
                    licenceUrl: ccBy4,
                    used: 'credits.streamlineUltimate.used',
                    changes: 'credits.iconSet.changes',
                },
                {
                    id: 'iconoir',
                    name: 'Iconoir',
                    author: 'Luca Burgio and Iconoir contributors',
                    url: 'https://iconoir.com',
                    licence: 'MIT',
                    licenceUrl: 'https://github.com/iconoir-icons/iconoir/blob/main/LICENSE',
                    used: 'credits.iconoir.used',
                    changes: 'credits.iconSet.changes',
                },
                {
                    id: 'libris-icon',
                    name: 'Libris icon (Streamline Freehand)',
                    author: streamline,
                    url: 'https://github.com/webalys-hq/streamline-vectors',
                    licence: 'CC BY 4.0',
                    licenceUrl: ccBy4,
                    used: 'credits.librisIcon.used',
                    changes: 'credits.librisIcon.changes',
                },
                {
                    id: 'turning-leaf',
                    name: 'Turning leaf',
                    author: 'Media Collection (generated with GPT Astra)',
                    url: 'https://github.com/m-brunet/media-collection-v2',
                    licence: 'Original artwork',
                    licenceUrl: null,
                    used: 'credits.turningLeaf.used',
                    changes: 'credits.turningLeaf.changes',
                },
            ],
        },
        {
            title: 'credits.group.fonts',
            credits: [
                {
                    id: 'inter',
                    name: 'Inter',
                    author: 'The Inter Project Authors',
                    url: 'https://github.com/rsms/inter',
                    licence: 'SIL Open Font License 1.1',
                    licenceUrl: ofl,
                    used: 'credits.inter.used',
                    changes: null,
                },
                {
                    id: 'space-grotesk',
                    name: 'Space Grotesk',
                    author: 'The Space Grotesk Project Authors',
                    url: 'https://github.com/floriankarsten/space-grotesk',
                    licence: 'SIL Open Font License 1.1',
                    licenceUrl: ofl,
                    used: 'credits.spaceGrotesk.used',
                    changes: null,
                },
                {
                    id: 'ibm-plex-mono',
                    name: 'IBM Plex Mono',
                    author: 'IBM Corp.',
                    url: 'https://github.com/IBM/plex',
                    licence: 'SIL Open Font License 1.1',
                    licenceUrl: ofl,
                    used: 'credits.ibmPlexMono.used',
                    changes: null,
                },
            ],
        },
        {
            title: 'credits.group.data',
            credits: [
                {
                    id: 'bnf',
                    name: 'Catalogue général de la BnF',
                    author: 'Bibliothèque nationale de France',
                    url: 'https://catalogue.bnf.fr',
                    licence: 'Licence Ouverte / Open Licence (Etalab)',
                    licenceUrl: 'https://www.etalab.gouv.fr/licence-ouverte-open-licence/',
                    used: 'credits.bnf.used',
                    changes: null,
                },
                {
                    id: 'open-library',
                    name: 'Open Library',
                    author: 'Internet Archive',
                    url: 'https://openlibrary.org',
                    licence: 'CC0 (data)',
                    licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
                    used: 'credits.openLibrary.used',
                    changes: null,
                },
            ],
        },
        {
            title: 'credits.group.libraries',
            credits: [
                {
                    id: 'sharp',
                    name: 'sharp',
                    author: 'Lovell Fuller and contributors',
                    url: 'https://sharp.pixelplumbing.com',
                    licence: 'Apache-2.0',
                    licenceUrl: apache,
                    used: 'credits.sharp.used',
                    changes: null,
                },
                {
                    id: 'libvips',
                    name: 'libvips',
                    author: 'John Cupitt and libvips contributors',
                    url: 'https://github.com/libvips/libvips',
                    licence: 'LGPL-3.0-or-later',
                    licenceUrl: 'https://www.gnu.org/licenses/lgpl-3.0.html',
                    used: 'credits.libvips.used',
                    changes: null,
                },
                {
                    id: 'barcode-detector',
                    name: 'barcode-detector',
                    author: 'Ze-Zheng Wu and contributors',
                    url: 'https://github.com/Sec-ant/barcode-detector',
                    licence: 'MIT',
                    licenceUrl: mit,
                    used: 'credits.barcodeDetector.used',
                    changes: null,
                },
                {
                    id: 'zxing-wasm',
                    name: 'zxing-wasm',
                    author: 'Ze-Zheng Wu and contributors',
                    url: 'https://github.com/Sec-ant/zxing-wasm',
                    licence: 'MIT',
                    licenceUrl: mit,
                    used: 'credits.zxingWasm.used',
                    changes: null,
                },
                {
                    id: 'zxing-cpp',
                    name: 'ZXing-C++',
                    author: 'Axel Waggershauser and contributors',
                    url: 'https://github.com/zxing-cpp/zxing-cpp',
                    licence: 'Apache-2.0',
                    licenceUrl: apache,
                    used: 'credits.zxingCpp.used',
                    changes: null,
                },
                {
                    id: 'acme-client',
                    name: 'acme-client',
                    author: 'Publishlab and contributors',
                    url: 'https://github.com/publishlab/node-acme-client',
                    licence: 'MIT',
                    licenceUrl: mit,
                    used: 'credits.acmeClient.used',
                    changes: null,
                },
                {
                    id: 'nat-api',
                    name: '@xmcl/nat-api',
                    author: 'Voxelum and contributors',
                    url: 'https://github.com/voxelum/nat-api',
                    licence: 'MIT',
                    licenceUrl: mit,
                    used: 'credits.natApi.used',
                    changes: null,
                },
                {
                    id: 'qrcode',
                    name: 'node-qrcode',
                    author: 'Ryan Day and contributors',
                    url: 'https://github.com/soldair/node-qrcode',
                    licence: 'MIT',
                    licenceUrl: mit,
                    used: 'credits.qrcode.used',
                    changes: null,
                },
            ],
        },
    ];
}
