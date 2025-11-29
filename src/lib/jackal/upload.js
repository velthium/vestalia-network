import { withSignerLock } from './utils.js';

/**
 * File upload operations
 */

export async function uploadFile(handler, file, parentPath) {
    // Ensure parentPath is clean (no 's/' prefix)
    const cleanParentPath = String(parentPath || '').replace(/^s\//, '');

    if (typeof handler.queueFile !== 'function' && typeof handler.loadDirectory === 'function') {
        try {
            await handler.loadDirectory({ path: cleanParentPath });
        } catch (e) {
            console.warn('uploadFile: failed to switch directory to', cleanParentPath, e);
        }
    }

    const tryQueue = async () => {
        if (typeof handler.queueFile === 'function') {
            try { await handler.queueFile(file, cleanParentPath); return true; } catch (e) {}
            try { await handler.queueFile(file); return true; } catch (e) {}
        }

        if (typeof handler.queuePrivate === 'function') {
            try { await handler.queuePrivate(file, 0); return true; } catch (e) {}
            try { await handler.queuePrivate([file], 0); return true; } catch (e) {}
            try { await handler.queuePrivate(file); return true; } catch (e) {}
        }

        if (typeof handler.queuePublic === 'function') {
            try { await handler.queuePublic(file, 0); return true; } catch (e) {}
            try { await handler.queuePublic([file], 0); return true; } catch (e) {}
            try { await handler.queuePublic(file); return true; } catch (e) {}
        }

        const altQueues = ['queue', 'addToQueue', 'enqueueFile'];
        for (const q of altQueues) {
            if (typeof handler[q] === 'function') {
                try { await handler[q](file, cleanParentPath); return true; } catch (e) {}
                try { await handler[q](file); return true; } catch (e) {}
            }
        }

        return false;
    };

    const queued = await tryQueue();
    if (!queued) throw new Error('No queue method available on StorageHandler');

    if (typeof handler.processQueue === 'function') {
        return await withSignerLock(async () => {
            try {
                const res = await handler.processQueue();
                // Some SDKs return structured result objects when events/timeouts occur.
                if (res && res.error && String(res.errorText || '').toLowerCase().includes('event timeout')) {
                    const txRes = res.txResponse || res.txResult || res.tx || null;
                    if (txRes && (txRes.code === 0 || txRes.code === '0')) {
                        // tx was broadcast successfully but event indexing timed out — treat as success
                        // eslint-disable-next-line no-console
                        console.debug('uploadFile: processQueue reported Event Timeout but txResponse success, treating as success', res);
                        return;
                    }
                }
                return;
            } catch (procErr) {
                const msg = procErr && procErr.message ? procErr.message : String(procErr);
                // If the chain reports the tx is already in the mempool/cache, treat as success
                if (/tx already exists in cache/i.test(msg) || (procErr && procErr.data && String(procErr.data).toLowerCase().includes('tx already exists')) ) {
                    // eslint-disable-next-line no-console
                    console.debug('uploadFile: processQueue reported tx already exists in cache, treating as success:', procErr);
                    return;
                }

                if (/account sequence mismatch|incorrect account sequence|code 32/i.test(msg)) {
                    try {
                        if (typeof handler.upgradeSigner === 'function') await safeUpgradeSigner(handler);
                        const retryRes = await handler.processQueue();
                        if (retryRes && retryRes.error && String(retryRes.errorText || '').toLowerCase().includes('event timeout')) {
                            const txRes = retryRes.txResponse || retryRes.txResult || retryRes.tx || null;
                            if (txRes && (txRes.code === 0 || txRes.code === '0')) {
                                // eslint-disable-next-line no-console
                                console.debug('uploadFile: processQueue retry produced Event Timeout but tx success, treating as success', retryRes);
                                return;
                            }
                        }
                        return;
                    } catch (retryErr) {
                        // eslint-disable-next-line no-console
                        console.debug('uploadFile: processQueue retry failed:', retryErr && retryErr.message ? retryErr.message : retryErr);
                    }
                }
                throw procErr;
            }
        });
    }

    if (typeof handler.processAllQueues === 'function') {
        try { if (typeof handler.upgradeSigner === 'function') await safeUpgradeSigner(handler); } catch (e) {}
        return await withSignerLock(async () => {
            try {
                const res = await handler.processAllQueues();
                if (res && res.error && String(res.errorText || '').toLowerCase().includes('event timeout')) {
                    const txRes = res.txResponse || res.txResult || res.tx || null;
                    if (txRes && (txRes.code === 0 || txRes.code === '0')) {
                        // eslint-disable-next-line no-console
                        console.debug('uploadFile: processAllQueues Event Timeout but txResponse success, treating as success', res);
                        return;
                    }
                }
                return res;
            } catch (errAll) {
                const m = errAll && errAll.message ? errAll.message : String(errAll || '');
                if (/tx already exists in cache/i.test(m) || (errAll && errAll.data && String(errAll.data).toLowerCase().includes('tx already exists'))) {
                    // eslint-disable-next-line no-console
                    console.debug('uploadFile: processAllQueues reported tx already exists in cache, treating as success', errAll);
                    return;
                }
                throw errAll;
            }
        });
    }

    if (typeof handler.processPending === 'function') { await handler.processPending(); return; }
    if (typeof handler.processPendingNotifications === 'function') { await handler.processPendingNotifications(); return; }
    if (typeof handler.saveFolder === 'function') { try { await handler.saveFolder(); return; } catch (e) {} }

    return;
}
