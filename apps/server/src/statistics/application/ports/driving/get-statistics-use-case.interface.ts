import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { StatisticsCategory } from '../../../domain/services/collection-progress.service.js';
import type { StatisticsView } from '../../statistics-views.js';

export interface GetStatisticsUseCase {
    execute(actor: Actor, category: StatisticsCategory | null): Promise<StatisticsView>;
}
