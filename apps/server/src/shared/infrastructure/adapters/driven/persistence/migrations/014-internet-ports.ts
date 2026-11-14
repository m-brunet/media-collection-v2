import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

interface SettingsSchema {
    server_settings: { id: string; name: string; value: string };
}

export class InternetPortsMigration implements Migration {
    private static readonly formerHttpsPort = 3443;
    private static readonly httpsPort = 34443;
    private static readonly formerRouterPort = 443;

    async up(db: Kysely<unknown>): Promise<void> {
        const schema = db as unknown as Kysely<SettingsSchema>;

        await this.change(schema, 'tls', (value) =>
            value.port === InternetPortsMigration.formerHttpsPort
                ? { ...value, port: InternetPortsMigration.httpsPort }
                : null,
        );
        await this.change(schema, 'internet-access', (value) =>
            value.phase !== 'off' && value.routerPort === undefined
                ? { ...value, routerPort: InternetPortsMigration.formerRouterPort }
                : null,
        );
    }

    private async change(
        db: Kysely<SettingsSchema>,
        name: string,
        changed: (value: Record<string, unknown>) => Record<string, unknown> | null,
    ): Promise<void> {
        const row = await db
            .selectFrom('server_settings')
            .select('value')
            .where('name', '=', name)
            .executeTakeFirst();

        if (!row) {
            return;
        }

        const value = changed(JSON.parse(row.value) as Record<string, unknown>);

        if (value) {
            await db
                .updateTable('server_settings')
                .set({ value: JSON.stringify(value) })
                .where('name', '=', name)
                .execute();
        }
    }
}
