import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { Failure } from '../../../../domain/exceptions/failure.js';

@Catch()
export class FailureFilter implements ExceptionFilter {
    catch(error: unknown, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<Response>();

        if (error instanceof Failure) {
            const statuses = {
                invalid_input: 400,
                not_found: 404,
                conflict: 409,
                unauthorized: 401,
                forbidden: 403,
            };

            response
                .status(statuses[error.code])
                .json({ code: error.code, reason: error.reason, message: error.message });
        } else if (error instanceof HttpException) {
            const value = error.getResponse();
            const message =
                typeof value === 'string'
                    ? value
                    : 'message' in value
                      ? value.message
                      : error.message;

            response.status(error.getStatus()).json({
                code: 'request_failed',
                message: Array.isArray(message) ? message.join(' ') : message,
            });
        } else {
            console.error(
                'An HTTP request failed:',
                error instanceof Error ? error.name : 'Unknown failure',
            );
            response.status(500).json({
                code: 'internal_error',
                message: 'The server could not complete this request.',
            });
        }
    }
}
