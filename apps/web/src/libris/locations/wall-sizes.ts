import type { BookCategory } from '../../../../../packages/contracts/src/http';

export const WallSizes = {
    bayWidth: 570,
    bayHeight: 84,
    spineMinWidth: 6,
    spineMaxWidth: 22,
    pagesAtMaxWidth: 900,
    spineMinHeight: 56,
    spineMaxHeight: 78,
    spineColours: 8,
    averagePages: { books: 400, manga: 200, comics: 70 } satisfies Record<BookCategory, number>,
} as const;
