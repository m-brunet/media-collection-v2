import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef } from 'react';
import type { BookCategory } from '../../../../../packages/contracts/src/http';
import type { BookDraftValues } from './book-draft.util';
import { BookDraft } from './book-draft.util';
import type { CategoryRule } from './category-lock.util';

export function useCategoryLock(
    rule: CategoryRule,
    category: BookCategory,
    setValues: Dispatch<SetStateAction<BookDraftValues>>,
): void {
    const locked = rule.kind === 'locked' ? rule.collection.category : null;
    const chosen = useRef(category);
    const lockedBefore = useRef<BookCategory | null>(null);

    useEffect(() => {
        if (locked) {
            if (lockedBefore.current === null) {
                chosen.current = category;
            }

            lockedBefore.current = locked;

            if (category !== locked) {
                setValues((current) => BookDraft.changed(current, { category: locked }));
            }

            return;
        }

        if (lockedBefore.current !== null) {
            lockedBefore.current = null;
            setValues((current) => BookDraft.changed(current, { category: chosen.current }));
        }
    }, [locked, category, setValues]);
}
