import type { MessageKey } from '../i18n/catalog-en';
import { useI18n } from '../i18n/i18n-context';

const known: Record<string, MessageKey> = {
    bnf: 'source.bnf',
    sudoc: 'source.sudoc',
    openlibrary: 'source.openlibrary',
    inventaire: 'source.inventaire',
    libris: 'source.libris',
};

export function useSourceNames() {
    const { t } = useI18n();

    return (sources: readonly string[]) =>
        sources.map((source) => (known[source] ? t(known[source]) : source)).join(', ');
}
