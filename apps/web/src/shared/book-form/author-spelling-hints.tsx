import type { AuthorSpellingDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../i18n/i18n-context';
import { Button } from '../ui/button';
import type { DraftAuthor } from './book-draft.util';
import { AuthorSpellings } from './author-spellings.util';
import { useSourceNames } from './use-source-names';

// Under the authors, for an existing author a lookup filled in: "BnF suggests: Flipsflops", or,
// once that spelling is taken, "Libris suggests: Flipflop's" (the author already in the library).
export function AuthorSpellingHints({
    authors,
    spellings,
    onChange,
}: {
    authors: DraftAuthor[];
    spellings: AuthorSpellingDto[];
    onChange(authors: DraftAuthor[]): void;
}) {
    const { t } = useI18n();
    const names = useSourceNames();
    const offered = AuthorSpellings.offered(authors, spellings);
    const taken = AuthorSpellings.taken(authors, spellings);

    if (offered.length === 0 && taken.length === 0) {
        return null;
    }

    return (
        <div className="author-spellings">
            {offered.map((spelling) => (
                <div key={'offered' + spelling.name} className="author-spellings__item">
                    <span className="field__hint author-spellings__text">
                        {t('lookup.spelling', {
                            sources: names(spelling.sources),
                            spelling: spelling.spelling,
                            name: spelling.name,
                        })}
                    </span>
                    <Button
                        variant="ghost"
                        aria-label={t('lookup.useSpellingOf', { spelling: spelling.spelling })}
                        onClick={() => onChange(AuthorSpellings.used(authors, spelling))}
                    >
                        {t('lookup.useSpelling')}
                    </Button>
                </div>
            ))}
            {taken.map((spelling) => (
                <div key={'taken' + spelling.name} className="author-spellings__item">
                    <span className="field__hint author-spellings__text">
                        {t('lookup.existingAuthor', {
                            spelling: spelling.spelling,
                            name: spelling.name,
                        })}
                    </span>
                    <Button
                        variant="ghost"
                        aria-label={t('lookup.useExistingAuthorOf', { name: spelling.name })}
                        onClick={() => onChange(AuthorSpellings.restored(authors, spelling))}
                    >
                        {t('lookup.useExistingAuthor')}
                    </Button>
                </div>
            ))}
        </div>
    );
}
