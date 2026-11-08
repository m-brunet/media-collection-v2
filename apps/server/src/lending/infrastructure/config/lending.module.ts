import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ValueProviders } from '../../../shared/infrastructure/config/value-providers.helper.js';
import type { BookLoanReader } from '../../../books/application/ports/driven/book-loan-reader.interface.js';
import type { LoanHistory } from '../../../books/application/ports/driven/loan-history.interface.js';
import type { ActiveLoans } from '../../application/ports/driven/active-loans.interface.js';
import type { LendableBooks } from '../../application/ports/driven/lendable-books.interface.js';
import type { LoanRepository } from '../../application/ports/driven/loan-repository.interface.js';
import type { ReceiverRepository } from '../../application/ports/driven/receiver-repository.interface.js';
import { BookLoanHistory } from '../../application/services/book-loan-history.service.js';
import { BookLoanLookup } from '../../application/services/book-loan-lookup.service.js';
import { ReceiverResolver } from '../../application/services/receiver-resolver.service.js';
import { FindReceivers } from '../../application/use-cases/find-receivers.usecase.js';
import { LendBooks } from '../../application/use-cases/lend-books.usecase.js';
import { ListActiveLoans } from '../../application/use-cases/list-active-loans.usecase.js';
import { RecordReturns } from '../../application/use-cases/record-returns.usecase.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import { LoansController } from '../adapters/driving/web/loans.controller.js';
import { ReceiversController } from '../adapters/driving/web/receivers.controller.js';

// Driven adapters and shared services the lending feature is composed from.
export interface LendingDependencies {
    loans: LoanRepository;
    receivers: ReceiverRepository;
    books: LendableBooks;
    active: ActiveLoans;
    ids: IdGenerator;
    clock: Clock;
    operations: AuditedOperation;
}

const token = {
    loans: 'LENDING_LOAN_REPOSITORY',
    receivers: 'LENDING_RECEIVER_REPOSITORY',
    books: 'LENDING_LENDABLE_BOOKS',
    active: 'LENDING_ACTIVE_LOANS',
    ids: 'LENDING_IDS',
    clock: 'LENDING_CLOCK',
    operations: 'LENDING_AUDITED_OPERATION',
    resolver: 'LENDING_RECEIVER_RESOLVER',
} as const;
const serviceProviders: Provider[] = [
    {
        provide: token.resolver,
        inject: [token.receivers, token.ids, token.clock],
        useFactory: (receivers: ReceiverRepository, ids: IdGenerator, clock: Clock) =>
            new ReceiverResolver(receivers, ids, clock),
    },
];
const useCaseProviders: Provider[] = [
    {
        provide: 'LENDING_LEND',
        inject: [
            token.books,
            token.loans,
            token.resolver,
            token.ids,
            token.clock,
            token.operations,
        ],
        useFactory: (
            books: LendableBooks,
            loans: LoanRepository,
            resolver: ReceiverResolver,
            ids: IdGenerator,
            clock: Clock,
            operations: AuditedOperation,
        ) => new LendBooks(books, loans, resolver, ids, clock, operations),
    },
    {
        provide: 'LENDING_RECORD_RETURNS',
        inject: [token.loans, token.receivers, token.clock, token.operations],
        useFactory: (
            loans: LoanRepository,
            receivers: ReceiverRepository,
            clock: Clock,
            operations: AuditedOperation,
        ) => new RecordReturns(loans, receivers, clock, operations),
    },
    {
        provide: 'LENDING_LIST_ACTIVE',
        inject: [token.active],
        useFactory: (active: ActiveLoans) => new ListActiveLoans(active),
    },
    {
        provide: 'LENDING_FIND_RECEIVERS',
        inject: [token.receivers],
        useFactory: (receivers: ReceiverRepository) => new FindReceivers(receivers),
    },
];

@Module({})
export class LendingModule {
    static register(dependencies: LendingDependencies): DynamicModule {
        return {
            module: LendingModule,
            controllers: [LoansController, ReceiversController],
            providers: [
                ...ValueProviders.of(dependencies, token),
                ...serviceProviders,
                ...useCaseProviders,
            ],
        };
    }

    // Which books are lent, read by the books feature for its views and its delete / Not Owned
    // guard.
    static bookLoans(loans: LoanRepository, receivers: ReceiverRepository): BookLoanReader {
        return new BookLoanLookup(loans, receivers);
    }

    // Keeps completed loans identifiable when the books feature deletes a book.
    static history(loans: LoanRepository): LoanHistory {
        return new BookLoanHistory(loans);
    }
}
