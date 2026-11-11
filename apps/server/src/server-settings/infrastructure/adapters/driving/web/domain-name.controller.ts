import { Body, Controller, Inject, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import type { SaveDomainNameUseCase } from '../../../../application/ports/driving/save-domain-name-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { Access } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';

const domainNameSchema = z.strictObject({
    domain: z.string().max(260).nullable(),
});

@Controller('api/server-settings/domain-name')
@Access('admin')
export class DomainNameController {
    constructor(
        @Inject('SERVER_SETTINGS_SAVE_DOMAIN_NAME')
        private readonly save: SaveDomainNameUseCase,
    ) {}

    @Put()
    async update(
        @Body({ schema: domainNameSchema }) input: z.infer<typeof domainNameSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<{ domain: string | null }> {
        return { domain: await this.save.execute(request.actor, input) };
    }
}
