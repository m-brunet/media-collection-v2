import { Controller, Get } from '@nestjs/common';
import { Access } from '../../../../shared/infrastructure/adapters/driving/web/api-guard.js';

@Controller('api/health')
export class HealthController {
    @Get()
    @Access('public')
    ready() {
        return { ready: true };
    }
}
