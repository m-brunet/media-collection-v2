import type { TagView } from '../tag-views.js';
import type { Tag } from '../../domain/entities/tag.entity.js';

export class TagViewer {
    view(tag: Tag, counts: ReadonlyMap<string, number>): TagView {
        return { id: tag.id, name: tag.snapshot.name, bookCount: counts.get(tag.id) ?? 0 };
    }
}
