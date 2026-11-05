import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Brand } from '../../shared/ui/brand';
import type { IconName } from '../../shared/ui/icon';
import { Icon } from '../../shared/ui/icon';
import { LanguageSwitch } from '../../shared/ui/language-switch';
import { RoleLabel } from '../../shared/role-label.util';

interface NavigationItem {
    to: string;
    label: MessageKey;
    icon: IconName;
}

// Each feature task adds its own entries here; only implemented pages appear.
const libraryItems: NavigationItem[] = [
    { to: '/books', label: 'nav.books', icon: 'books' },
    { to: '/collections', label: 'nav.collections', icon: 'collections' },
];
const administrationItems: NavigationItem[] = [
    { to: '/admin/accounts', label: 'nav.accounts', icon: 'accounts' },
    { to: '/admin/appearance', label: 'nav.appearance', icon: 'appearance' },
    { to: '/admin/server', label: 'nav.server', icon: 'server' },
];

function NavigationLink({ item }: { item: NavigationItem }) {
    const { t } = useI18n();

    return (
        <li>
            <NavLink to={item.to} className="nav-link">
                <Icon name={item.icon} />
                <span>{t(item.label)}</span>
            </NavLink>
        </li>
    );
}

export function AppShell({ children }: { children: ReactNode }) {
    const { t } = useI18n();
    const { account } = useSession();

    return (
        <div className="shell">
            <a className="skip-link" href="#main">
                {t('nav.skip')}
            </a>
            <aside className="sidebar">
                <Brand app="libris" />
                <nav aria-label={t('nav.main')} className="sidebar__nav">
                    {libraryItems.length > 0 && (
                        <>
                            <p className="eyebrow sidebar__section">{t('nav.library')}</p>
                            <ul className="nav-list">
                                {libraryItems.map((item) => (
                                    <NavigationLink key={item.to} item={item} />
                                ))}
                            </ul>
                        </>
                    )}
                    {account?.role === 'admin' && (
                        <>
                            <p className="eyebrow sidebar__section">{t('nav.administration')}</p>
                            <ul className="nav-list">
                                {administrationItems.map((item) => (
                                    <NavigationLink key={item.to} item={item} />
                                ))}
                            </ul>
                        </>
                    )}
                </nav>
                <div className="sidebar__footer">
                    <ul className="nav-list">
                        <NavigationLink
                            item={{ to: '/account', label: 'nav.account', icon: 'account' }}
                        />
                    </ul>
                    {account && (
                        <p className="sidebar__identity">
                            {t('nav.signedInAs', {
                                username: account.username,
                                role: t(RoleLabel.name(account.role)),
                            })}
                        </p>
                    )}
                    <LanguageSwitch />
                </div>
            </aside>
            <main id="main" className="shell__main">
                {children}
            </main>
        </div>
    );
}
