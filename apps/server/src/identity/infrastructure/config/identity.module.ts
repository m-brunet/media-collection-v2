import { AccountLoader } from '../../application/services/account-loader.service.js';
import { CurrentPasswordConfirmation } from '../../application/services/current-password-confirmation.service.js';
import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { PasswordHasher } from '../../application/ports/driven/password-hasher.interface.js';
import type { SessionTokens } from '../../application/ports/driven/session-tokens.interface.js';
import type { UserRepository } from '../../application/ports/driven/user-repository.interface.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import { RenewSession } from '../../application/use-cases/renew-session.usecase.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import { ManagedAccountLoader } from '../../application/services/managed-account-loader.service.js';
import { CompleteSetup } from '../../application/use-cases/complete-setup.usecase.js';
import { DeactivateAccount } from '../../application/use-cases/deactivate-account.usecase.js';
import { ReactivateAccount } from '../../application/use-cases/reactivate-account.usecase.js';
import { ResetPassword } from '../../application/use-cases/reset-password.usecase.js';
import { SetupStatus } from '../../application/use-cases/setup-status.usecase.js';
import { ChangeLanguage } from '../../application/use-cases/change-language.usecase.js';
import { ChangePassword } from '../../application/use-cases/change-password.usecase.js';
import { ChangeUsername } from '../../application/use-cases/change-username.usecase.js';
import { CreateUser } from '../../application/use-cases/create-user.usecase.js';
import { ListUsers } from '../../application/use-cases/list-users.usecase.js';
import { Login } from '../../application/use-cases/login.usecase.js';
import { HttpSessions } from '../../../shared/infrastructure/adapters/driving/web/http-sessions.service.js';
import { LoginLimiter } from '../../../shared/infrastructure/adapters/driving/web/login-limiter.service.js';
import { AccountsController } from '../adapters/driving/web/accounts.controller.js';
import { IdentityController } from '../adapters/driving/web/identity.controller.js';
import { SetupAccess } from '../adapters/driving/web/setup-access.service.js';
import { SetupController } from '../adapters/driving/web/setup.controller.js';

export const IDENTITY_USER_REPOSITORY = 'IDENTITY_USER_REPOSITORY';
export const IDENTITY_PASSWORD_HASHER = 'IDENTITY_PASSWORD_HASHER';
export const IDENTITY_SESSION_TOKENS = 'IDENTITY_SESSION_TOKENS';
export const IDENTITY_ID_GENERATOR = 'IDENTITY_ID_GENERATOR';
export const IDENTITY_CLOCK = 'IDENTITY_CLOCK';
export const IDENTITY_HTTP_SESSIONS = 'IDENTITY_HTTP_SESSIONS';
export const IDENTITY_LOGIN = 'IDENTITY_LOGIN';
export const IDENTITY_CHANGE_USERNAME = 'IDENTITY_CHANGE_USERNAME';
export const IDENTITY_CHANGE_PASSWORD = 'IDENTITY_CHANGE_PASSWORD';
export const IDENTITY_CHANGE_LANGUAGE = 'IDENTITY_CHANGE_LANGUAGE';
export const IDENTITY_LIST_USERS = 'IDENTITY_LIST_USERS';
export const IDENTITY_CREATE_USER = 'IDENTITY_CREATE_USER';
export const IDENTITY_SESSION_RENEWAL = 'IDENTITY_SESSION_RENEWAL';
export const IDENTITY_AUDITED_OPERATION = 'IDENTITY_AUDITED_OPERATION';
export const IDENTITY_SETUP_STATUS = 'IDENTITY_SETUP_STATUS';
export const IDENTITY_COMPLETE_SETUP = 'IDENTITY_COMPLETE_SETUP';
export const IDENTITY_RESET_PASSWORD = 'IDENTITY_RESET_PASSWORD';
export const IDENTITY_DEACTIVATE_ACCOUNT = 'IDENTITY_DEACTIVATE_ACCOUNT';
export const IDENTITY_REACTIVATE_ACCOUNT = 'IDENTITY_REACTIVATE_ACCOUNT';

@Module({})
export class IdentityModule {
    static register(
        users: UserRepository,
        passwords: PasswordHasher,
        tokens: SessionTokens,
        ids: IdGenerator,
        clock: Clock,
        sessions: HttpSessions,
        operations: AuditedOperation,
        setupAccess: SetupAccess,
    ): DynamicModule {
        return {
            module: IdentityModule,
            controllers: [IdentityController, AccountsController, SetupController],
            providers: [
                { provide: IDENTITY_USER_REPOSITORY, useValue: users },
                { provide: IDENTITY_PASSWORD_HASHER, useValue: passwords },
                { provide: IDENTITY_SESSION_TOKENS, useValue: tokens },
                { provide: IDENTITY_ID_GENERATOR, useValue: ids },
                { provide: IDENTITY_CLOCK, useValue: clock },
                { provide: IDENTITY_HTTP_SESSIONS, useValue: sessions },
                { provide: IDENTITY_AUDITED_OPERATION, useValue: operations },
                { provide: SetupAccess, useValue: setupAccess },
                {
                    provide: ManagedAccountLoader,
                    inject: [IDENTITY_USER_REPOSITORY],
                    useFactory: (users: UserRepository) => new ManagedAccountLoader(users),
                },
                {
                    provide: IDENTITY_SETUP_STATUS,
                    inject: [IDENTITY_USER_REPOSITORY],
                    useFactory: (users: UserRepository) => new SetupStatus(users),
                },
                {
                    provide: IDENTITY_COMPLETE_SETUP,
                    inject: [
                        IDENTITY_USER_REPOSITORY,
                        IDENTITY_PASSWORD_HASHER,
                        IDENTITY_SESSION_TOKENS,
                        IDENTITY_ID_GENERATOR,
                        IDENTITY_CLOCK,
                        IDENTITY_AUDITED_OPERATION,
                    ],
                    useFactory: (
                        users: UserRepository,
                        passwords: PasswordHasher,
                        tokens: SessionTokens,
                        ids: IdGenerator,
                        clock: Clock,
                        operations: AuditedOperation,
                    ) => new CompleteSetup(users, passwords, tokens, ids, clock, operations),
                },
                {
                    provide: IDENTITY_RESET_PASSWORD,
                    inject: [
                        IDENTITY_USER_REPOSITORY,
                        ManagedAccountLoader,
                        IDENTITY_PASSWORD_HASHER,
                        IDENTITY_AUDITED_OPERATION,
                    ],
                    useFactory: (
                        users: UserRepository,
                        accounts: ManagedAccountLoader,
                        passwords: PasswordHasher,
                        operations: AuditedOperation,
                    ) => new ResetPassword(users, accounts, passwords, operations),
                },
                {
                    provide: IDENTITY_DEACTIVATE_ACCOUNT,
                    inject: [
                        IDENTITY_USER_REPOSITORY,
                        ManagedAccountLoader,
                        IDENTITY_AUDITED_OPERATION,
                    ],
                    useFactory: (
                        users: UserRepository,
                        accounts: ManagedAccountLoader,
                        operations: AuditedOperation,
                    ) => new DeactivateAccount(users, accounts, operations),
                },
                {
                    provide: IDENTITY_REACTIVATE_ACCOUNT,
                    inject: [
                        IDENTITY_USER_REPOSITORY,
                        ManagedAccountLoader,
                        IDENTITY_AUDITED_OPERATION,
                    ],
                    useFactory: (
                        users: UserRepository,
                        accounts: ManagedAccountLoader,
                        operations: AuditedOperation,
                    ) => new ReactivateAccount(users, accounts, operations),
                },
                {
                    provide: AccountLoader,
                    inject: [IDENTITY_USER_REPOSITORY],
                    useFactory: (users: UserRepository) => new AccountLoader(users),
                },
                {
                    provide: CurrentPasswordConfirmation,
                    inject: [IDENTITY_PASSWORD_HASHER],
                    useFactory: (passwords: PasswordHasher) =>
                        new CurrentPasswordConfirmation(passwords),
                },
                {
                    provide: IDENTITY_LOGIN,
                    inject: [
                        IDENTITY_USER_REPOSITORY,
                        IDENTITY_PASSWORD_HASHER,
                        IDENTITY_SESSION_TOKENS,
                        IDENTITY_AUDITED_OPERATION,
                    ],
                    useFactory: (
                        users: UserRepository,
                        passwords: PasswordHasher,
                        tokens: SessionTokens,
                        operations: AuditedOperation,
                    ) => new Login(users, passwords, tokens, operations),
                },
                {
                    provide: IDENTITY_CHANGE_USERNAME,
                    inject: [
                        IDENTITY_USER_REPOSITORY,
                        AccountLoader,
                        CurrentPasswordConfirmation,
                        IDENTITY_AUDITED_OPERATION,
                    ],
                    useFactory: (
                        users: UserRepository,
                        accounts: AccountLoader,
                        confirmation: CurrentPasswordConfirmation,
                        operations: AuditedOperation,
                    ) => new ChangeUsername(users, accounts, confirmation, operations),
                },
                {
                    provide: IDENTITY_CHANGE_PASSWORD,
                    inject: [
                        IDENTITY_USER_REPOSITORY,
                        AccountLoader,
                        IDENTITY_PASSWORD_HASHER,
                        CurrentPasswordConfirmation,
                        IDENTITY_AUDITED_OPERATION,
                    ],
                    useFactory: (
                        users: UserRepository,
                        accounts: AccountLoader,
                        passwords: PasswordHasher,
                        confirmation: CurrentPasswordConfirmation,
                        operations: AuditedOperation,
                    ) => new ChangePassword(users, accounts, passwords, confirmation, operations),
                },
                {
                    provide: IDENTITY_CHANGE_LANGUAGE,
                    inject: [IDENTITY_USER_REPOSITORY, AccountLoader, IDENTITY_AUDITED_OPERATION],
                    useFactory: (
                        users: UserRepository,
                        accounts: AccountLoader,
                        operations: AuditedOperation,
                    ) => new ChangeLanguage(users, accounts, operations),
                },
                {
                    provide: IDENTITY_LIST_USERS,
                    inject: [IDENTITY_USER_REPOSITORY],
                    useFactory: (users: UserRepository) => new ListUsers(users),
                },
                {
                    provide: IDENTITY_CREATE_USER,
                    inject: [
                        IDENTITY_USER_REPOSITORY,
                        IDENTITY_PASSWORD_HASHER,
                        IDENTITY_ID_GENERATOR,
                        IDENTITY_CLOCK,
                        IDENTITY_AUDITED_OPERATION,
                    ],
                    useFactory: (
                        users: UserRepository,
                        passwords: PasswordHasher,
                        ids: IdGenerator,
                        clock: Clock,
                        operations: AuditedOperation,
                    ) => new CreateUser(users, passwords, ids, clock, operations),
                },
                {
                    provide: IDENTITY_SESSION_RENEWAL,
                    inject: [AccountLoader, IDENTITY_SESSION_TOKENS],
                    useFactory: (accounts: AccountLoader, tokens: SessionTokens) =>
                        new RenewSession(accounts, tokens),
                },
                { provide: HttpSessions, useExisting: IDENTITY_HTTP_SESSIONS },
                { provide: LoginLimiter, useFactory: () => new LoginLimiter() },
            ],
        };
    }
}
