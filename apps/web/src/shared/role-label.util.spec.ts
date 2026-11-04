import { expect, it } from 'vitest';
import { RoleLabel } from './role-label.util';

it('names the administrator role', () => {
    const role = 'admin';

    const result = RoleLabel.name(role);

    expect(result).toBe('role.admin');
});

it('names the owner role', () => {
    const role = 'owner';

    const result = RoleLabel.name(role);

    expect(result).toBe('role.owner');
});

it('names the guest role', () => {
    const role = 'guest';

    const result = RoleLabel.name(role);

    expect(result).toBe('role.guest');
});

it('explains what a guest may do', () => {
    const role = 'guest';

    const result = RoleLabel.description(role);

    expect(result).toBe('role.guestDescription');
});
