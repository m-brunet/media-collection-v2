import { Body, Controller, Get, Inject, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import type { ReadAppearanceUseCase } from '../../../../application/ports/driving/read-appearance-use-case.interface.js';
import type { SaveAppearanceUseCase } from '../../../../application/ports/driving/save-appearance-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { Access } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { Appearance } from '../../../../../../../../packages/contracts/src/http.js';

const appearanceSchema = z.strictObject({
    colorScheme: z.string().min(1).max(40),
});

@Controller('api/appearance')
export class AppearanceController {
    constructor(
        @Inject('APPEARANCE_READ') private readonly readAppearance: ReadAppearanceUseCase,
        @Inject('APPEARANCE_SAVE') private readonly saveAppearance: SaveAppearanceUseCase,
    ) {}

    // Public: every page, including sign-in, shows the installation's colours.
    @Get()
    @Access('public')
    read(): Promise<Appearance> {
        return this.readAppearance.execute();
    }

    @Put()
    @Access('admin')
    save(
        @Body({ schema: appearanceSchema }) input: z.infer<typeof appearanceSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<Appearance> {
        return this.saveAppearance.execute(request.actor, input.colorScheme);
    }
}
