"use client"
import { useEffect } from 'react'
import { useRouter } from 'next/navigation';
import { showAccountEmptyAlert } from '@/utils/alerts/error';

if (typeof window !== 'undefined') {
    const [_warn, _error, _log] = [console.warn, console.error, console.log];
    const shouldFilter = (msg) => msg.includes('Jackal.js |') && (msg.includes('key not found') || msg.includes('singleLoadMeta') || msg.includes('loadRefMeta'));
    const wrap = (orig) => function(...args) { const msg = args.join(' '); if (shouldFilter(msg)) { if (window.__VESTALIA_DEBUG__) orig.apply(console, args); return; } orig.apply(console, args); };
    console.warn = wrap(_warn); console.error = wrap(_error); console.log = wrap(_log);
    
    // Global lock to prevent multiple simultaneous Keplr approval requests
    window.__VESTALIA_SIGNER_LOCK__ = false;
}

function BootstrapClient() {
    const router = useRouter();
    useEffect(() => {
        const [originalInfo, originalDebug] = [console.info, console.debug];
        try { if (process.env.NODE_ENV === 'production' && !window.__VESTALIA_DEBUG__) { console.info = console.debug = () => {}; } } catch (e) {}
        require('bootstrap/dist/js/bootstrap.bundle.min.js');
        let lastAccountAlert = 0;
        const ALERT_COOLDOWN_MS = 2500;

        const previousOnError = window.onerror;
        const silenced = ['does not exist on chain', 'Send some tokens', 'Unable to add filesystem', 'scroll-behavior: smooth', 'Request rejected', 'enableFullSigner', 'upgradeSigner', 'key not found', 'singleLoadMeta'];
        const handleAccountEmpty = async (msg) => { if (!(msg.includes('does not exist') || msg.includes('Send some tokens'))) return; const now = Date.now(); if (now - lastAccountAlert > ALERT_COOLDOWN_MS) { lastAccountAlert = now; try { const res = await showAccountEmptyAlert('Account empty', 'This wallet has no JACKAL (JKL). Would you like to visit Pricing to top up?'); if (res?.isConfirmed) try { router.push('/pricing'); } catch (e) { window.location.href = '/pricing'; } else if (res?.isDismissed) try { router.push('/'); } catch (e) { window.location.href = '/'; } } catch (e) { console.debug('showAccountEmptyAlert failed:', e); } } };
        window.onerror = function(message, source, lineno, colno, error) { try { const msg = (error?.message || (typeof message === 'string' ? message : '')); if (msg && (msg.includes('does not exist on chain') || msg.includes('Send some tokens'))) { handleAccountEmpty(msg); return true; } } catch (e) {} return typeof previousOnError === 'function' ? previousOnError(message, source, lineno, colno, error) : false; };

        const onWindowError = async (ev, source, lineno, colno, error) => {
            const msg = (error?.message || ev?.message || String(ev || ''));
            if (!silenced.some(p => msg?.includes(p))) return;
            try { ev?.preventDefault?.(); ev?.stopImmediatePropagation?.(); } catch (e) {}
            if (msg?.includes('Unable to add filesystem')) { try { console.group('BootstrapClient: FS error'); console.error('msg:', msg, 'event:', ev, 'error:', error); console.groupEnd(); } catch (e) { console.error('BootstrapClient: FS error (fallback):', msg, e); } } else { console.debug('BootstrapClient: suppressed window error:', msg); }
            await handleAccountEmpty(msg);
        };

        const onUnhandledRejection = async (ev) => {
            const msg = (ev?.reason?.message || String(ev?.reason || ''));
            if (!silenced.some(p => msg?.includes(p))) return;
            try { ev?.preventDefault?.(); ev?.stopImmediatePropagation?.(); } catch (e) {}
            if (msg?.includes('Unable to add filesystem')) { try { console.group('BootstrapClient: FS unhandledRejection'); console.error('reason:', ev.reason, 'event:', ev); console.groupEnd(); } catch (e) { console.error('BootstrapClient: FS unhandledRejection (fallback):', msg, e); } } else { console.debug('BootstrapClient: suppressed unhandledrejection:', msg); }
            await handleAccountEmpty(msg);
        };

        window.addEventListener('error', onWindowError);
        window.addEventListener('unhandledrejection', onUnhandledRejection);

        let dragCounter = 0;
        const onDragEnter = (ev) => { ev.preventDefault(); dragCounter += 1; document.body.classList.add('drag-over'); };
        const onDragOver = (ev) => ev.preventDefault();
        const onDragLeave = (ev) => { ev.preventDefault(); dragCounter = Math.max(0, dragCounter - 1); if (dragCounter === 0) document.body.classList.remove('drag-over'); };
        const onDropGlobal = (ev) => { ev.preventDefault(); dragCounter = 0; document.body.classList.remove('drag-over'); };

        window.addEventListener('dragenter', onDragEnter);
        window.addEventListener('dragover', onDragOver);
        window.addEventListener('dragleave', onDragLeave);
        window.addEventListener('drop', onDropGlobal);
        window.addEventListener('dragend', onDragLeave);

        return () => {
            try { console.info = originalInfo; console.debug = originalDebug; } catch (e) {}
            window.removeEventListener('error', onWindowError);
            window.removeEventListener('unhandledrejection', onUnhandledRejection);
            try { window.onerror = previousOnError; } catch (e) {}
            window.removeEventListener('dragenter', onDragEnter);
            window.removeEventListener('dragover', onDragOver);
            window.removeEventListener('dragleave', onDragLeave);
            window.removeEventListener('drop', onDropGlobal);
            window.removeEventListener('dragend', onDragLeave);
        };
    }, [router]);
    return null;
}

export default BootstrapClient;