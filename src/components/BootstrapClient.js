"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation';
import { showErrorAlert } from '@/utils/alerts/error';

function BootstrapClient() {
    const router = useRouter();

    useEffect(() => {
        require('bootstrap/dist/js/bootstrap.bundle.min.js');

        const onWindowError = async (eventOrMessage, source, lineno, colno, error) => {
            const msg = (error && error.message) || (eventOrMessage && eventOrMessage.message) || String(eventOrMessage || '');

            if (msg.includes('does not exist on chain') || msg.includes('Send some tokens')) {
                try {
                    await showErrorAlert(
                        'Account empty',
                        'This wallet has no JACKAL (JKL). Please send some JKL tokens to your address before using the Vault. Redirecting to Pricing...'
                    );
                } catch (e) {
                    console.warn('showErrorAlert failed:', e);
                }

                try {
                    router.push('/pricing');
                } catch (e) {
                    window.location.href = '/pricing';
                }
            }
        };

        const onUnhandledRejection = async (ev) => {
            const reason = ev && ev.reason;
            const msg = (reason && reason.message) || String(reason || '');

            if (msg.includes('does not exist on chain') || msg.includes('Send some tokens')) {
                try {
                    await showErrorAlert(
                        'Account empty',
                        'This wallet has no JACKAL (JKL). Please send some JKL tokens to your address before using the Vault. Redirecting to Pricing...'
                    );
                } catch (e) {
                    console.warn('showErrorAlert failed:', e);
                }

                try {
                    router.push('/pricing');
                } catch (e) {
                    window.location.href = '/pricing';
                }
            }
        };

        window.addEventListener('error', onWindowError);
        window.addEventListener('unhandledrejection', onUnhandledRejection);

        return () => {
            window.removeEventListener('error', onWindowError);
            window.removeEventListener('unhandledrejection', onUnhandledRejection);
        };
    }, [router]);

    return null;
}

export default BootstrapClient;