/**
 * Jackal StorageHandler helper wrappers
 * - Normalizes reads across SDK shapes
 * - Adds safeUpgradeSigner to silence user-rejected signer prompts
 * - Provides robust deleteItem and renameItem with many fallback shapes
 */

// --- Constants ---
const JACKAL_ROOT = ["s", "Home"];

// Simple in-memory mutex to serialize signer actions (prevents concurrent Keplr signature popups)
let _signerLock = false;
async function withSignerLock(fn) {
    while (_signerLock) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 50));
    }
    _signerLock = true;
    try {
        return await fn();
    } finally {
        _signerLock = false;
    }
}

// Safe upgrade helper: call handler.upgradeSigner() but swallow user-rejected errors
export async function safeUpgradeSigner(handler) {
    if (!handler || typeof handler.upgradeSigner !== 'function') return false;
    return await withSignerLock(async () => {
        try {
            await handler.upgradeSigner();
            return true;
        } catch (e) {
            const msg = e && e.message ? e.message : String(e || '');
            if (/request rejected|user rejected/i.test(msg)) {
                // eslint-disable-next-line no-console
                console.debug('safeUpgradeSigner: user rejected signer request');
                return false;
            }
            // eslint-disable-next-line no-console
            console.debug('safeUpgradeSigner: upgradeSigner failed:', msg);
            return false;
        }
    });
}

// ------------------ Read Helpers ------------------
export async function loadDirectoryContents(handler, path, ownerCandidates = []) {
    const tried = [];
    let result = null;

    if (!ownerCandidates || ownerCandidates.length === 0) {
        try {
            if (handler && handler.jackalClient && typeof handler.jackalClient.getICAJackalAddress === 'function') {
                ownerCandidates.push(await handler.jackalClient.getICAJackalAddress());
            }
        } catch (e) {}

        try {
            if (handler && handler.jackalClient && typeof handler.jackalClient.getICAAddress === 'function') {
                ownerCandidates.push(await handler.jackalClient.getICAAddress());
            }
        } catch (e) {}

        if (handler && handler.client && handler.client.details && handler.client.details.address) {
            ownerCandidates.push(handler.client.details.address);
        }
        if (handler && handler.jackalClient && typeof handler.jackalClient.getJackalAddress === 'function') {
            try { ownerCandidates.push(await handler.jackalClient.getJackalAddress()); } catch (e) {}
        }
    }

    ownerCandidates = Array.from(new Set(ownerCandidates.filter(Boolean)));

    let lookupPath = typeof path === 'string' ? path : '';
    lookupPath = lookupPath.replace(/^\/?s(\/?|$)/, '');

    for (const owner of ownerCandidates) {
        tried.push(owner);
        if (typeof handler.readDirectoryContents === 'function') {
            try {
                const res = await handler.readDirectoryContents(lookupPath, { owner, refresh: true });
                // eslint-disable-next-line no-console
                console.debug('loadDirectoryContents: attempt owner ->', owner, 'result ->', res);
                result = res;
            } catch (e) {
                // eslint-disable-next-line no-console
                console.debug('loadDirectoryContents: attempt owner ->', owner, 'threw ->', e && e.message ? e.message : e);
                result = null;
            }
        }
        if (result && (result.folders || result.files)) break;
    }

    if (!result) {
        if (typeof handler.readDirectoryContents === 'function') {
            try {
                result = await handler.readDirectoryContents(lookupPath);
            } catch (e) {
                result = null;
            }
        }
    }

    if (!result && typeof handler.loadDirectory === 'function') {
        try {
            await handler.loadDirectory(lookupPath);
            result = handler.children || handler.directory || null;
        } catch (e) {
            result = null;
        }
    }

    if ((!result || (Object.keys(result || {}).length === 0)) && tried.length > 0) {
        // eslint-disable-next-line no-console
        console.debug("loadDirectoryContents: no result, tried owners:", tried, "handler.children:", handler && handler.children);
    }

    if (result && (result.folders || result.files)) {
        const folders = Object.values(result.folders || {}).map((f) => ({
            name: f.whoAmI || f.name || f.description || "",
            isDir: true,
            raw: f,
        }));

        const files = Object.values(result.files || {}).map((file) => ({
            name: file.fileMeta?.name || file.name || "",
            isDir: false,
            size: (file.fileMeta && file.fileMeta.size) || file.size || 0,
            raw: file,
        }));

        return [...folders, ...files];
    }

    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.children)) return result.children;

    return [];
}

export async function downloadFile(handler, filePath, tracker, raw) {
    // Remove 's/' prefix if present
    let cleanPath = filePath.replace(/^s\//, '');
    
    // Ensure tracker exists as it is required by the SDK
    if (!tracker) {
        tracker = { progress: 0, chunks: [] };
    }
    
    // Load provider pool first to avoid "No providers found" error
    try {
        const availableProviders = await handler.getAvailableProviders();
        if (availableProviders && availableProviders.length > 0) {
            const providerIps = await handler.findProviderIps(availableProviders);
            await handler.loadProviderPool(providerIps);
        } else {
            console.warn('downloadFile: No available providers found via getAvailableProviders');
        }
    } catch (e) {
        console.debug('downloadFile: loadProviderPool error:', e?.message || e);
    }

    // Try downloadByUlid if available and we have the ULID
    if (raw && (raw.ulid || raw.fileMeta?.ulid) && typeof handler.downloadByUlid === 'function') {
        try {
            const ulid = raw.ulid || raw.fileMeta?.ulid;
            const ulidStr = typeof ulid === 'string' ? ulid : ulid.toString();
            
            let userAddress = null;
            if (handler.jackalClient && typeof handler.jackalClient.getJackalAddress === 'function') {
                userAddress = await handler.jackalClient.getJackalAddress();
            } else if (handler.client && handler.client.details && handler.client.details.address) {
                userAddress = handler.client.details.address;
            }

            if (userAddress) {
                console.debug('downloadFile: attempting downloadByUlid', ulidStr, 'user:', userAddress);
                return await handler.downloadByUlid({
                    ulid: ulidStr,
                    trackers: tracker,
                    userAddress: userAddress
                });
            } else {
                console.warn('downloadFile: cannot use downloadByUlid without userAddress');
            }
        } catch (e) {
            console.warn('downloadFile: downloadByUlid failed, falling back to path download', e);
        }
    }
    
    // Use the full path and pass the tracker
    return await handler.downloadFile(cleanPath, tracker);
}

export async function getStorageStatus(handler) {
    if (!handler) return null;
    try {
        return await handler.planStatus();
    } catch (e) {
        console.warn('getStorageStatus failed:', e);
        return null;
    }
}

// ------------------ Write/Action Helpers ------------------
export async function createNewFolder(handler, parentPath, folderName) {
    if (!handler || !folderName || !parentPath) {
        throw new Error("Missing handler, path, or folder name.");
    }
    await handler.createFolders({ parentPath: parentPath, names: [folderName] });
}

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

export async function deleteItem(handler, fullPath, isDir = false, raw = null) {
    if (!handler || !fullPath) throw new Error('Missing handler or path for delete');

    // For files, construct IFileDeletePackage { creator, merkle, start } from fileMeta
    if (!isDir && raw && raw.fileMeta) {
        const fileMeta = raw.fileMeta;
        
        // eslint-disable-next-line no-console
        console.debug('deleteItem: raw.fileMeta =', fileMeta);
        
        // Get creator address (owner of the file)
        let creator = null;
        try {
            if (handler && handler.jackalClient) {
                if (typeof handler.jackalClient.getJackalAddress === 'function') {
                    creator = await handler.jackalClient.getJackalAddress();
                } else if (handler.jackalClient.details && handler.jackalClient.details.address) {
                    creator = handler.jackalClient.details.address;
                }
            }
            if (!creator && handler.client && handler.client.details && handler.client.details.address) {
                creator = handler.client.details.address;
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.debug('deleteItem: failed to get creator address:', e);
        }

        // Extract merkle root and start index from fileMeta
        const merkle = fileMeta.merkleRoot || fileMeta.merkle;
        const start = fileMeta.start !== undefined ? fileMeta.start : 0;

        // eslint-disable-next-line no-console
        console.debug('deleteItem: extracted values ->', { creator, merkle, start });

        if (creator && merkle) {
            // Try queueDelete + processQueue first (most reliable for files)
            if (typeof handler.queueDelete === 'function') {
                try {
                    // eslint-disable-next-line no-console
                    console.debug('deleteItem: trying queueDelete with fileMeta');
                    await withSignerLock(() => handler.queueDelete(fileMeta));
                    
                    if (typeof handler.processQueue === 'function') {
                        await withSignerLock(async () => {
                            try { await safeUpgradeSigner(handler); } catch (e) {}
                            const res = await handler.processQueue();
                            // eslint-disable-next-line no-console
                            console.debug('deleteItem: processQueue result:', res);
                        });
                    }
                    return true;
                } catch (errQueue) {
                    // eslint-disable-next-line no-console
                    console.debug('deleteItem: queueDelete(fileMeta) + processQueue failed:', errQueue && errQueue.message ? errQueue.message : errQueue);
                }
            }

            // Construct IFileDeletePackage
            const deletePackage = {
                creator: creator,
                merkle: merkle,
                start: start
            };

            // Try deleteFile with the proper package
            if (typeof handler.deleteFile === 'function') {
                try {
                    // eslint-disable-next-line no-console
                    console.debug('deleteItem: trying deleteFile with IFileDeletePackage:', deletePackage);
                    await withSignerLock(() => handler.deleteFile(deletePackage));
                    return true;
                } catch (errPkg) {
                    // eslint-disable-next-line no-console
                    console.debug('deleteItem: deleteFile(IFileDeletePackage) failed:', errPkg && errPkg.message ? errPkg.message : errPkg);
                }
            }

            // Try deleteTargets with the package
            if (typeof handler.deleteTargets === 'function') {
                try {
                    // eslint-disable-next-line no-console
                    console.debug('deleteItem: trying deleteTargets with IFileDeletePackage:', { hashpath: deletePackage });
                    await withSignerLock(() => handler.deleteTargets({ hashpath: deletePackage }));
                    return true;
                } catch (errTargets) {
                    // eslint-disable-next-line no-console
                    console.debug('deleteItem: deleteTargets(hashpath) failed:', errTargets && errTargets.message ? errTargets.message : errTargets);
                }
            }
        } else {
            // eslint-disable-next-line no-console
            console.debug('deleteItem: missing creator or merkle for IFileDeletePackage construction', { creator, merkle, fileMeta });
        }
    }

    const fileMethods = [ 'deleteFile','deleteFiles','removeFile','removeFiles','queueDelete','delete' ];
    const folderMethods = [ 'deleteFolder','deleteFolders','removeFolder','removeFolders','rmdir','delete' ];
    const tryList = isDir ? folderMethods : fileMethods;

    for (const m of tryList) {
        if (typeof handler[m] === 'function') {
            try {
                if (m.endsWith('s')) {
                    await withSignerLock(() => handler[m]([fullPath]));
                } else if (m === 'queueDelete') {
                    await withSignerLock(() => handler.queueDelete(fullPath));
                    if (typeof handler.processQueue === 'function') await withSignerLock(() => handler.processQueue());
                } else {
                    await withSignerLock(() => handler[m](fullPath));
                }
                return true;
            } catch (err) {
                // eslint-disable-next-line no-console
                console.debug(`deleteItem: method ${m} failed:`, err && err.message ? err.message : err);
            }
        }
    }

    if (typeof handler.deleteTargets === 'function') {
        const candidates = [];
        try {
            const active = (typeof handler.readActivePath === 'function') ? handler.readActivePath() : (handler.activePath || '');
            const normalized = String(fullPath || '').replace(/^\/?/, '');
            const strippedS = normalized.replace(/^s\/?/, '');
            const parts = normalized.split('/').filter(Boolean);
            const basename = parts.length ? parts[parts.length - 1] : normalized;

            if (active && normalized.startsWith(active.replace(/^\/?/, ''))) {
                const rel = normalized.slice(active.replace(/^\/?/, '').length).replace(/^\/?/, '');
                if (rel) candidates.push(rel);
            }

            candidates.push(basename);
            candidates.push(strippedS);
            candidates.push(normalized);
        } catch (eCandidates) {
            const parts = String(fullPath || '').split('/').filter(Boolean);
            candidates.push(parts.length ? parts[parts.length - 1] : fullPath);
        }

        const uniq = Array.from(new Set(candidates.filter(Boolean)));

        const tryDeleteTargets = async (payload) => {
            try {
                // Ensure signer upgrades/locks happen inside the signer mutex to avoid
                // multiple concurrent Keplr approval prompts. Some StorageHandler
                // implementations will prompt on deleteTargets even for payload validation.
                return await withSignerLock(async () => {
                    try {
                        await handler.deleteTargets(payload);
                        return true;
                    } catch (eInner) {
                        // eslint-disable-next-line no-console
                        console.debug('deleteItem: deleteTargets attempt failed for payload', payload, eInner && eInner.message ? eInner.message : eInner);
                        return false;
                    }
                });
            } catch (e) {
                // eslint-disable-next-line no-console
                console.debug('deleteItem: deleteTargets attempt outer failure', payload, e && e.message ? e.message : e);
                return false;
            }
        };

        // Try to perform a safe signer upgrade once before iterating many delete attempts.
        try {
            if (typeof handler.upgradeSigner === 'function') {
                // safeUpgradeSigner will swallow user-rejected prompts
                await safeUpgradeSigner(handler);
            }
        } catch (eUp) {
            // eslint-disable-next-line no-console
            console.debug('deleteItem: safeUpgradeSigner failed (ignored):', eUp && eUp.message ? eUp.message : eUp);
        }

        for (const cand of uniq) {
            if (await tryDeleteTargets({ targets: [cand] })) return true;
            if (await tryDeleteTargets([cand])) return true;
            if (await tryDeleteTargets(cand)) return true;
            if (await tryDeleteTargets({ targets: [{ name: cand }] })) return true;
            if (await tryDeleteTargets({ targets: [{ target: cand }] })) return true;

            if (raw) {
                if (await tryDeleteTargets({ targets: [raw] })) return true;
                if (raw.fileMeta && await tryDeleteTargets({ targets: [{ file: raw.fileMeta }] })) return true;
                if (raw.folder && await tryDeleteTargets({ targets: [{ folder: raw.folder }] })) return true;

                const ref = (raw && (raw.ref || raw.fileMeta?.ref || raw.fileMeta?.reference || raw.folder?.ref)) || undefined;
                const location = (typeof handler.readCurrentLocation === 'function') ? handler.readCurrentLocation() : (handler.activePath || undefined);
                const fullShape = { targets: [{ name: cand, ref, location }] };
                if (await tryDeleteTargets(fullShape)) return true;

                const nested = { targets: [{ target: { name: cand, ref, location } }] };
                if (await tryDeleteTargets(nested)) return true;
            }

            if (typeof handler.queueDelete === 'function') {
                try {
                    await withSignerLock(() => handler.queueDelete(cand));
                    if (typeof handler.processQueue === 'function') {
                        await withSignerLock(async () => {
                            try { await safeUpgradeSigner(handler); } catch (e) {}
                            try {
                                const res = await handler.processQueue();
                                if (res && res.error && String(res.errorText || '').toLowerCase().includes('event timeout')) {
                                    const txRes = res.txResponse || res.txResult || res.tx || null;
                                    if (txRes && (txRes.code === 0 || txRes.code === '0')) {
                                        // eslint-disable-next-line no-console
                                        console.debug('deleteItem: queueDelete processQueue Event Timeout but tx success, treating as success', res);
                                    }
                                }
                            } catch (qProcErr) {
                                const m = qProcErr && qProcErr.message ? qProcErr.message : String(qProcErr);
                                if (/tx already exists in cache/i.test(m) || (qProcErr && qProcErr.data && String(qProcErr.data).toLowerCase().includes('tx already exists'))) {
                                    // eslint-disable-next-line no-console
                                    console.debug('deleteItem: processQueue reported tx already exists in cache, treating as success', qProcErr);
                                } else {
                                    throw qProcErr;
                                }
                            }
                        });
                    }
                    return true;
                } catch (qErr) {
                    // eslint-disable-next-line no-console
                    console.debug('deleteItem: queueDelete attempt failed', cand, qErr && qErr.message ? qErr.message : qErr);
                }
            }

            // eslint-disable-next-line no-console
            console.debug('deleteItem: candidate exhausted', cand);
        }

        // eslint-disable-next-line no-console
        console.debug('deleteItem: deleteTargets attempts exhausted for', fullPath, 'candidates', uniq);
    }

    // Additional best-effort for files: some StorageHandler versions require the full
    // file metadata (fileMeta) or a ref/ulid instead of a plain name. Try to locate
    // a matching fileMeta via listChildFileMetas and attempt deleteTargets/queueDelete
    // using that metadata shape.
    if (!isDir && typeof handler.listChildFileMetas === 'function') {
        try {
            const list = await handler.listChildFileMetas().catch(() => null);
            if (Array.isArray(list) && list.length) {
                const nameToMatch = (raw && (raw.fileMeta?.name || raw.name)) || String(fullPath).split('/').pop();
                const match = list.find(m => (m && (m.name === nameToMatch || m.fileMeta?.name === nameToMatch)));
                if (match) {
                    // Try a few shapes the SDK might expect
                    const tryMeta = async (meta) => {
                        const attempts = [
                            { targets: [meta] },
                            { targets: [{ file: meta }] },
                            { targets: [{ ref: meta.ref }] },
                            { targets: [{ ulid: meta.ulid || (meta.ulid && meta.ulid.toString && meta.ulid.toString()) }] },
                            [meta],
                            meta
                        ];

                        for (const p of attempts) {
                            try {
                                await handler.deleteTargets(p);
                                // eslint-disable-next-line no-console
                                console.debug('deleteItem: deleteTargets succeeded with meta payload', p);
                                return true;
                            } catch (e) {
                                // eslint-disable-next-line no-console
                                console.debug('deleteItem: meta-shaped deleteTargets failed for payload', p, e && e.message ? e.message : e);
                            }
                        }

                        // queueDelete with meta (some handlers accept objects)
                        if (typeof handler.queueDelete === 'function') {
                            try {
                                await withSignerLock(() => handler.queueDelete(meta));
                                if (typeof handler.processQueue === 'function') {
                                    try { await safeUpgradeSigner(handler); } catch (s) {}
                                    try {
                                        const res = await handler.processQueue();
                                        if (res && res.error && String(res.errorText || '').toLowerCase().includes('event timeout')) {
                                            const txRes = res.txResponse || res.txResult || res.tx || null;
                                            if (txRes && (txRes.code === 0 || txRes.code === '0')) {
                                                // eslint-disable-next-line no-console
                                                console.debug('deleteItem: queueDelete(meta) processQueue Event Timeout but tx success, treating as success', res);
                                            }
                                        }
                                    } catch (qProcErr) {
                                        const m = qProcErr && qProcErr.message ? qProcErr.message : String(qProcErr);
                                        if (/tx already exists in cache/i.test(m) || (qProcErr && qProcErr.data && String(qProcErr.data).toLowerCase().includes('tx already exists'))) {
                                            // eslint-disable-next-line no-console
                                            console.debug('deleteItem: processQueue reported tx already exists in cache, treating as success', qProcErr);
                                        } else {
                                            throw qProcErr;
                                        }
                                    }
                                }
                                // eslint-disable-next-line no-console
                                console.debug('deleteItem: queueDelete succeeded with meta', meta);
                                return true;
                            } catch (qErr) {
                                // eslint-disable-next-line no-console
                                console.debug('deleteItem: queueDelete with meta failed', qErr && qErr.message ? qErr.message : qErr);
                            }
                        }

                        return false;
                    };

                    if (await tryMeta(match)) return true;
                    // try nested fileMeta if present
                    if (match.fileMeta && await tryMeta(match.fileMeta)) return true;
                }
            }
        } catch (eList) {
            // eslint-disable-next-line no-console
            console.debug('deleteItem: listChildFileMetas attempt failed', eList && eList.message ? eList.message : eList);
        }
    }

    throw new Error('Delete not supported by StorageHandler (tried standard and fallback methods)');
}

export async function renameItem(handler, oldFullPath, newFullPathOrName, isDir = false, raw = null) {
    if (!handler || !oldFullPath || !newFullPathOrName) throw new Error('Missing args for rename');

    const isFullPath = newFullPathOrName.includes('/');
    let targetPath = newFullPathOrName;
    if (!isFullPath) {
        const parts = oldFullPath.split('/');
        parts.pop();
        parts.push(newFullPathOrName);
        targetPath = parts.join('/');
    }

    const lookupOld = typeof oldFullPath === 'string' ? oldFullPath.replace(/^\/?s(\/?|$)/, '') : oldFullPath;
    const lookupTarget = typeof targetPath === 'string' ? targetPath.replace(/^\/?s(\/?|$)/, '') : targetPath;

    const moveMethods = ['move','moveFile','moveFolder','rename','renameFile','renameFolder'];
    for (const m of moveMethods) {
        if (typeof handler[m] === 'function') {
            try {
                if (m === 'renameFile' || m === 'renameFolder' || m === 'rename') {
                    const targetName = targetPath.split('/').pop();
                    await handler[m](oldFullPath, targetName);
                } else {
                    await handler[m](oldFullPath, targetPath);
                }
                return true;
            } catch (err) {
                // eslint-disable-next-line no-console
                console.debug(`renameItem: method ${m} failed:`, err && err.message ? err.message : err);
            }
        }
    }

    if (!isDir) {
        try {
            if (typeof handler.downloadFile === 'function') {
                const blob = await handler.downloadFile(lookupOld);
                const name = lookupTarget.split('/').pop();
                const file = new File([blob], name);
                const parent = lookupTarget.split('/').slice(0, -1).join('/');
                await uploadFile(handler, file, parent);
                await deleteItem(handler, lookupOld, false, raw);
                return true;
            }
        } catch (copyErr) {
            // eslint-disable-next-line no-console
            console.debug('renameItem: copy-then-delete early attempt failed:', copyErr && copyErr.message ? copyErr.message : copyErr);
        }
    }

    if (typeof handler.moveRenameResource === 'function') {
        try {
            const targetName = targetPath.split('/').pop();
            const location = targetPath.split('/').slice(0, -1).join('/');
            let fileMeta = raw && raw.fileMeta ? raw.fileMeta : null;
            let folderMeta = raw && raw.folderMeta ? raw.folderMeta : null;

            try {
                if (!fileMeta && !isDir && typeof handler.getFileMetaData === 'function') {
                    fileMeta = await handler.getFileMetaData(oldFullPath).catch(() => null);
                }
            } catch (e) {}

            try {
                if (!folderMeta && isDir && typeof handler.getFolderDetailsByUlid === 'function') {
                    const ulid = raw && (raw.ulid || raw.ulid?.toString() || raw.ulid?.ulid);
                    if (ulid) folderMeta = await handler.getFolderDetailsByUlid({ ulid }).catch(() => null);
                }
            } catch (e) {}

            try {
                if (!fileMeta && !isDir && typeof handler.listChildFileMetas === 'function') {
                    const list = await handler.listChildFileMetas().catch(() => null);
                    if (Array.isArray(list)) {
                        const match = list.find(m => (m.name && (m.name === (raw?.fileMeta?.name || raw?.name))) || (m.fileMeta && m.fileMeta.name === (raw?.fileMeta?.name || raw?.name)));
                        if (match) fileMeta = match;
                    }
                }
            } catch (e) {}

            try {
                if (!folderMeta && isDir && typeof handler.listChildFolderMetas === 'function') {
                    const list = await handler.listChildFolderMetas().catch(() => null);
                    if (Array.isArray(list)) {
                        const match = list.find(m => (m.name && (m.name === (raw?.whoAmI || raw?.name))) || (m.folder && m.folder.name === (raw?.whoAmI || raw?.name)));
                        if (match) folderMeta = match;
                    }
                }
            } catch (e) {}

            let parentLocation = null;
            try { if (typeof handler.readCurrentLocation === 'function') parentLocation = handler.readCurrentLocation(); } catch (e) {}

            const moveTarget = { name: targetName, ref: (fileMeta && fileMeta.ref) || (folderMeta && folderMeta.ref) || (raw && raw.ref) || 0 };
            if (parentLocation) moveTarget.location = parentLocation;
            if (isDir) {
                if (folderMeta) moveTarget.folder = folderMeta;
                else if (raw && raw.folder) moveTarget.folder = raw.folder;
                else if (raw) moveTarget.folder = raw;
            } else {
                if (fileMeta) moveTarget.file = fileMeta;
                else if (raw && raw.fileMeta) moveTarget.file = raw.fileMeta;
                else if (raw) moveTarget.file = raw;
            }

            const hasValidTarget = (isDir && !!moveTarget.folder) || (!isDir && !!moveTarget.file);
            if (!hasValidTarget) throw new Error('IMoveRenameTarget construction failed: missing file/folder metadata');

            try {
                // eslint-disable-next-line no-console
                console.debug('renameItem: calling moveRenameResource with targets:', moveTarget);
                await withSignerLock(() => handler.moveRenameResource({ targets: [moveTarget] }));
                return true;
            } catch (errMove) {
                // eslint-disable-next-line no-console
                console.debug('renameItem: moveRenameResource failed:', errMove && errMove.message ? errMove.message : errMove);
                throw errMove;
            }
        } catch (e1) {
            // eslint-disable-next-line no-console
            console.debug('renameItem: moveRenameResource unexpected failure', e1);
        }
    }

    if (typeof handler.downloadFile === 'function') {
        try {
            const blob = await handler.downloadFile(oldFullPath);
            const name = targetPath.split('/').pop();
            const file = new File([blob], name);
            const parent = targetPath.split('/').slice(0, -1).join('/');
            await uploadFile(handler, file, parent);
            await deleteItem(handler, oldFullPath, isDir, raw);
            return true;
        } catch (err) {
            // eslint-disable-next-line no-console
            console.debug('renameItem: copy-then-delete fallback failed:', err && err.message ? err.message : err);
        }
    }

    throw new Error('Rename/Move not supported by StorageHandler');
}