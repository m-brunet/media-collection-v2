# Architecture review skill validation

These are manual review scenarios and expected outcomes, not claims of automated SOLID verification. The revised skill
targets [AGENTS.md](../AGENTS.md). Source and CLI fixtures enforce the driving/driven/config layout; the
[migration record](architecture-migration-plan.md) describes implementation and verification.

| Scenario                                                                              | Expected review outcome                                                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A use case imports Kysely, NestJS, Zod, or `node:fs`                                  | Mandatory purity/DIP violation; introduce a driven port and compose its adapter in config                    |
| A driving controller imports/instantiates a concrete repository                       | Mandatory boundary/DIP violation even within infrastructure; consume a driving interface                     |
| A domain entity imports an application port or DI token                               | Mandatory inward-dependency violation; application owns orchestration and config owns tokens                 |
| A driven adapter imports NestJS or uses `@Injectable()`                               | Mandatory violation; compose the plain adapter with a factory provider                                       |
| A controller imports NestJS in the driving web boundary                               | Accept; the framework is at the infrastructure periphery                                                     |
| An ORM decorator or Kysely row type appears in a domain entity                        | Mandatory entity/storage separation violation; mapping belongs in driven persistence                         |
| A repository maps Kysely rows to pure domain objects                                  | Accept; no ORM, decorated storage class or unnecessary mapper is required                                    |
| A use case has no driving interface or a controller is typed as the concrete use case | Mandatory entry-contract violation; implement/consume the focused driving port                               |
| A Nest factory parameter uses a concrete repository type                              | Mandatory wiring-contract violation; use the driven port type and module-owned string token                  |
| A repository omits owner filtering                                                    | Mandatory ownership/LSP failure, including for administrators; restore filtering and HTTP isolation coverage |
| A class has unrelated account creation, billing and notification responsibilities     | Mandatory SRP violation when independent reasons to change are demonstrated; split responsibilities          |
| Existing interchangeable providers require a growing selection chain                  | Mandatory OCP finding when variation/change pressure is demonstrated; add the smallest extension mechanism   |
| A conditional expresses one business invariant                                        | Accept absent a concrete SOLID violation; no speculative strategy                                            |
| A read-only client must depend on unrelated administration methods                    | Mandatory ISP finding; split actual consumer capabilities                                                    |
| A double weakens errors, mutation or ownership guarantees                             | Mandatory LSP finding; align observable contract and behavior tests                                          |
| A plain entity/use case depends on one narrow repository interface                    | Accept; no speculative factories, inheritance or extra layers                                                |
| An import uses deep `../` paths and `.js`                                             | Accept after resolving the actual destination; no project alias                                              |
| A review-only request includes manually added code                                    | Report findings/corrections without editing source                                                           |

Skill-creator's `scripts/quick_validate.py` checks metadata/scaffolding rather than architectural reasoning. CLI fixtures
separately exercise structural enforcement of the implemented layout. Neither replaces manual SOLID and observable
port-contract review. Root `AGENTS.md` requires this skill before completing code changes.

The implemented CLI suite includes regression cases for driving/config NestJS allowances, driven NestJS/decorator
rejection, adapter direction, concrete-use-case access, shared/root exceptions, nested port ownership, driving-interface
implementation, and folder naming. The completion record reports the executed checks and baseline formatting limits.
