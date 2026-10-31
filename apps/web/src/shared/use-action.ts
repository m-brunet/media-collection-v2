import { useState } from 'react';

export function useAction() {
    const [ busy, setBusy ] = useState(false);
    const [ message, setMessage ] = useState('');
    const run = async (action: () => Promise<void>, success = '') => {
        setBusy(true);
        setMessage('');

        try {
            await action();
            setMessage(success);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'The request failed.');
        } finally {
            setBusy(false);
        }
    };

    return { busy, message, run, setMessage };
}
