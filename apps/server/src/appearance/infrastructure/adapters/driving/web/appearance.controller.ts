import { Body, Controller, Get, Inject, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import type { ReadAppearanceUseCase } from '../../../../application/ports/driving/read-appearance-use-case.interface.js';
import type { SaveAppearanceUseCase } from '../../../../application/ports/driving/save-appearance-use-case.interface.js';
import type { SaveIconSetUseCase } from '../../../../application/ports/driving/save-icon-set-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { Access } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type {
    Appearance,
    IconSetName,
} from '../../../../../../../../packages/contracts/src/http.js';

const appearanceSchema = z.strictObject({
    colorScheme: z.string().min(1).max(40),
});
const iconSetSchema = z.strictObject({
    iconSet: z.string().min(1).max(40),
});

@Controller('api/appearance')
export class AppearanceController {
    constructor(
        @Inject('APPEARANCE_READ') private readonly readAppearance: ReadAppearanceUseCase,
        @Inject('APPEARANCE_SAVE') private readonly saveAppearance: SaveAppearanceUseCase,
        @Inject('APPEARANCE_SAVE_ICON_SET') private readonly saveIconSet: SaveIconSetUseCase,
    ) {}

    // Public: every page, including sign-in, shows the installation's colours and icons.
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
    ): Promise<Pick<Appearance, 'colorScheme'>> {
        return this.saveAppearance.execute(request.actor, input.colorScheme);
    }

    @Put('icon-set')
    @Access('admin')
    saveIcons(
        @Body({ schema: iconSetSchema }) input: z.infer<typeof iconSetSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<{ iconSet: IconSetName }> {
        return this.saveIconSet.execute(request.actor, input.iconSet);
    }
}
