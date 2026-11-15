import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { useSession } from '../../shared/session/session-context';
import type { ListName } from './list-memory.util';
import { ListMemory } from './list-memory.util';

export const choicesGiven = { listChoices: true } as const;

export function useListMemory(list: ListName): boolean {
    const { account } = useSession();
    const location = useLocation();
    const [parameters, setParameters] = useSearchParams();
    const guest = account?.role === 'guest';
    const decide = (accountId: string) => {
        const given =
            ListMemory.recognizes(list, parameters) ||
            (location.state as { listChoices?: boolean } | null)?.listChoices === true;
        const remembered = given ? null : ListMemory.read(accountId, list, guest);

        return { key: location.key, remembered: remembered?.size ? remembered : null };
    };
    const [opened, setOpened] = useState(() => (account ? decide(account.id) : null));

    if (account && opened === null) {
        setOpened(decide(account.id));
    }

    const restoring =
        opened === null || (opened.remembered !== null && location.key === opened.key);

    useEffect(() => {
        if (!account || !opened) {
            return;
        }

        if (restoring && opened.remembered) {
            const next = new URLSearchParams(parameters);

            for (const [key, value] of opened.remembered) {
                next.append(key, value);
            }

            setParameters(next, { replace: true, state: location.state });

            return;
        }

        ListMemory.write(account.id, list, ListMemory.choices(list, parameters, guest));
    }, [account, guest, list, location.state, opened, parameters, restoring, setParameters]);

    return restoring;
}
