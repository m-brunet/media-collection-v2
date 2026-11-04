import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { LanguageSwitch } from '../../shared/ui/language-switch';
import { PageHeader, Panel } from '../../shared/ui/layout';
import { PasswordForm } from './password-form';
import { UsernameForm } from './username-form';
import { RoleLabel } from '../../shared/role-label.util';

export function AccountPage() {
    const { t } = useI18n();
    const { account, signOut } = useSession();

    if (!account) {
        return null;
    }

    return (
        <>
            <PageHeader title={t('account.title')} intro={t('account.intro')} />
            <div className="panel-grid">
                <Panel label={t('account.profile')}>
                    <UsernameForm account={account} />
                    <div className="field">
                        <span className="field__label">{t('language.label')}</span>
                        <LanguageSwitch />
                        <p className="field__hint">{t('account.languageHint')}</p>
                    </div>
                </Panel>
                <Panel label={t('password.sectionTitle')}>
                    <PasswordForm />
                </Panel>
                <Panel label={t('account.roleTitle')}>
                    <p className="panel__title">{t(RoleLabel.name(account.role))}</p>
                    <p className="muted">{t(RoleLabel.description(account.role))}</p>
                    <div className="actions">
                        <Button icon="sign-out" onClick={() => void signOut()}>
                            {t('account.signOut')}
                        </Button>
                    </div>
                </Panel>
            </div>
        </>
    );
}
