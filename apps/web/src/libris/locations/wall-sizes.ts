import type { BookCategory } from '../../../../../packages/contracts/src/http';

export const WallSizes = {
    bayWidth: 570,
    bayHeight: 84,
    bayBorder: 6,
    shelfNameWidth: 92,
    shelfGap: 12,
    spineMinWidth: 6,
    spineMaxWidth: 22,
    pagesAtMaxWidth: 900,
    spineMinHeight: 50,
    spineMaxHeight: 68,
    spineColours: 8,
    panelColumns: 5,
    panelCoversMax: 16,
    coverMinWidth: 58,
    coverGap: 8,
    averagePages: { books: 400, manga: 200, comics: 70 } satisfies Record<BookCategory, number>,
} as const;
