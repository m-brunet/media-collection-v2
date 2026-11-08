import { Body, Controller, Inject, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import type { SaveKeepAwakeUseCase } from '../../../../application/ports/driving/save-keep-awake-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { Access } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';

const keepAwakeSchema = z.strictObject({ enabled: z.boolean() });

@Controller('api/server-settings/keep-awake')
@Access('admin')
export class KeepAwakeController {
    constructor(
        @Inject('SERVER_SETTINGS_SAVE_KEEP_AWAKE') private readonly save: SaveKeepAwakeUseCase,
    ) {}

    @Put()
    async update(
        @Body({ schema: keepAwakeSchema }) input: z.infer<typeof keepAwakeSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<{ enabled: boolean }> {
        return { enabled: await this.save.execute(request.actor, input) };
    }
}
