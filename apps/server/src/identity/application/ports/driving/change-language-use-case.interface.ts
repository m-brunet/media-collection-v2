import type { Actor, InterfaceLanguage } from '../../../../shared/domain/actor.helper.js';

export interface ChangeLanguageUseCase {
    execute(actor: Actor, language: InterfaceLanguage): Promise<Actor>;
}
