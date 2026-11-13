import { useState } from 'react';
import type {
    BookBatchDto,
    BookBatchInputDto,
    SimilarAuthorDetails,
} from '../../../../../packages/contracts/src/http';
import { api, ApiError } from '../../shared/api.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useAction } from '../../shared/use-action';
import type { BatchDraft, BatchProblem } from './collection-batch.util';
import { CollectionBatch } from './collection-batch.util';

const problems: Record<BatchProblem, MessageKey> = {
    nothing: 'batch.problem.nothing',
    category: 'batch.problem.category',
    ownership: 'batch.problem.ownership',
    publisher: 'batch.problem.publisher',
    price: 'batch.problem.price',
    shelf: 'location.shelfRequired',
    authors: 'batch.problem.authors',
    read: 'batch.problem.read',
};

export function useBatchEdit({
    collectionId,
    onPlanned,
    onSaved,
}: {
    collectionId: string;
    onPlanned(summary: BookBatchDto): void;
    onSaved(result: BookBatchDto): void;
}) {
    const action = useAction();
    const [similar, setSimilar] = useState<SimilarAuthorDetails | null>(null);
    const send = (bookIds: string[], draft: BatchDraft, preview: boolean) => {
        const problem = CollectionBatch.problem(draft);

        if (problem) {
            action.fail(problems[problem]);

            return;
        }

        const body: BookBatchInputDto = {
            collectionId,
            bookIds,
            preview,
            changes: CollectionBatch.changes(draft),
        };

        void action.run(async () => {
            try {
                const result = await api.request<BookBatchDto>('/books/batch-edit', {
                    method: 'POST',
                    body,
                });

                if (preview) {
                    onPlanned(result);
                } else {
                    onSaved(result);
                }
            } catch (error) {
                if (error instanceof ApiError && error.reason === 'author-similar') {
                    setSimilar(error.details as unknown as SimilarAuthorDetails);

                    return;
                }

                throw error;
            }
        });
    };

    return {
        busy: action.busy,
        feedback: action.feedback,
        clearFeedback: () => action.setFeedback(null),
        similar,
        dismissSimilar: () => setSimilar(null),
        send,
    };
}
