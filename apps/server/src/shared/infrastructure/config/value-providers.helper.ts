import type { Provider } from '@nestjs/common';

export class ValueProviders {
    static of<T extends object>(
        dependencies: T,
        tokens: { readonly [K in keyof T]: string },
    ): Provider[] {
        return (Object.keys(dependencies) as (keyof T)[]).map((name) => ({
            provide: tokens[name],
            useValue: dependencies[name],
        }));
    }
}
