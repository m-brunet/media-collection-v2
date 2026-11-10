import { Link } from 'react-router';
import type { Credit } from '../../shared/credits/credits.util';
import { Credits } from '../../shared/credits/credits.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Brand } from '../../shared/ui/brand';
import { LanguageSwitch } from '../../shared/ui/language-switch';
import { PageHeader, Panel } from '../../shared/ui/layout';

export function CreditsPage({ standalone = false }: { standalone?: boolean }) {
    const { t } = useI18n();
    const content = (
        <>
            <PageHeader title={t('credits.title')} intro={t('credits.intro')} />
            {Credits.groups.map((group) => (
                <Panel key={group.title} title={t(group.title)}>
                    <ul className="credit-list">
                        {group.credits.map((credit) => (
                            <CreditItem key={credit.id} credit={credit} />
                        ))}
                    </ul>
                </Panel>
            ))}
        </>
    );

    if (!standalone) {
        return content;
    }

    return (
        <div className="credits-standalone">
            <header className="credits-standalone__header">
                <Brand app="libris" />
                <Link to="/">{t('credits.backToSignIn')}</Link>
            </header>
            <main className="credits-standalone__main">{content}</main>
            <LanguageSwitch />
        </div>
    );
}

function CreditItem({ credit }: { credit: Credit }) {
    const { t } = useI18n();

    return (
        <li className="credit">
            <h3 className="credit__name">
                <a href={credit.url} target="_blank" rel="noreferrer">
                    {credit.name}
                </a>
            </h3>
            <dl className="credit__facts">
                <div>
                    <dt>{t('credits.author')}</dt>
                    <dd>{credit.author}</dd>
                </div>
                <div>
                    <dt>{t('credits.licence')}</dt>
                    <dd>
                        {credit.licenceUrl ? (
                            <a href={credit.licenceUrl} target="_blank" rel="noreferrer">
                                {credit.licence}
                            </a>
                        ) : (
                            credit.licence
                        )}
                    </dd>
                </div>
                <div>
                    <dt>{t('credits.used')}</dt>
                    <dd>{t(credit.used)}</dd>
                </div>
                <div>
                    <dt>{t('credits.changes')}</dt>
                    <dd>{credit.changes ? t(credit.changes) : t('credits.unchanged')}</dd>
                </div>
            </dl>
            {credit.notice && <p className="credit__notice">{t(credit.notice)}</p>}
        </li>
    );
}
