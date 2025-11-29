import { NullMetaHandler } from '@jackallabs/jackal.js';

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

async function genAesBundle() {
    const key = new Uint8Array(32);
    const iv = new Uint8Array(16);
    if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(key);
        window.crypto.getRandomValues(iv);
    } else {
        for(let i=0; i<32; i++) key[i] = Math.floor(Math.random() * 256);
        for(let i=0; i<16; i++) iv[i] = Math.floor(Math.random() * 256);
    }
    return { key, iv };
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

    const cleanPath = String(fullPath || '').replace(/^s\//, '');
    const parts = cleanPath.split('/');
    const fileName = parts.pop(); // Remove file name, remaining is parent
    const parentPath = parts.join('/');

    console.debug('deleteItem: target', { fullPath, cleanPath, parentPath, fileName });

    // 1. Ensure we are in the correct directory
    try {
        const targetDir = parentPath || 'Home';
        console.debug('deleteItem: switching to directory', targetDir);
        if (typeof handler.loadDirectory === 'function') {
            await handler.loadDirectory({ path: targetDir });
        }
    } catch (e) {
        console.warn('deleteItem: loadDirectory failed', e);
    }

    // 2. Verify file existence in current view
    try {
        if (typeof handler.listChildFiles === 'function') {
            const files = handler.listChildFiles();
            console.debug('deleteItem: files in current dir:', files);
            if (!files.includes(fileName)) {
                console.warn(`deleteItem: file "${fileName}" not found in current directory listing. It might be a ghost file.`);
            }
        }
    } catch (e) {
        console.warn('deleteItem: listChildFiles failed', e);
    }

    // 3. Attempt deletion using deleteTargets (standard method)
    if (typeof handler.deleteTargets === 'function') {
        try {
            console.debug(`deleteItem: calling deleteTargets for "${fileName}"`);
            await withSignerLock(() => handler.deleteTargets({ targets: [fileName] }));
            return true;
        } catch (err) {
            const msg = err?.message || String(err);
            console.warn('deleteItem: deleteTargets failed:', msg);
            
            if (!msg.includes('invalid request') && !msg.includes('code 18')) {
                throw err;
            }
            console.debug('deleteItem: deleteTargets returned empty msg, attempting fallbacks...');
        }
    }

    // 4. Fallback: Try using raw metadata (IFileDeletePackage) if available
    // This is useful if the file is not in the current directory listing but we have its metadata
    if (!isDir && raw && raw.fileMeta) {
        const fileMeta = raw.fileMeta;
        const merkle = fileMeta.merkleRoot || fileMeta.merkle;
        const start = fileMeta.start !== undefined ? fileMeta.start : 0;
        
        // We need the creator address
        let creator = null;
        try {
            if (handler.jackalClient && typeof handler.jackalClient.getJackalAddress === 'function') {
                creator = await handler.jackalClient.getJackalAddress();
            } else if (handler.client && handler.client.details) {
                creator = handler.client.details.address;
            }
        } catch (e) {}

        if (creator && merkle) {
            const deletePackage = { creator, merkle, start };
            console.debug('deleteItem: attempting deleteFile with package', deletePackage);
            
            if (typeof handler.deleteFile === 'function') {
                try {
                    await withSignerLock(() => handler.deleteFile(deletePackage));
                    return true;
                } catch (e) {
                    console.warn('deleteItem: deleteFile fallback failed', e);
                }
            }
        }
    }

    // 5. Fallback: Try deleting by ULID if available
    if (raw && (raw.ulid || raw.fileMeta?.ulid)) {
        const ulid = raw.ulid || raw.fileMeta?.ulid;
        console.debug('deleteItem: trying deletion by ULID', ulid);
        
        if (typeof handler.queueDelete === 'function') {
            try {
                await withSignerLock(() => handler.queueDelete(ulid));
                if (typeof handler.processQueue === 'function') {
                    await withSignerLock(() => handler.processQueue());
                }
                return true;
            } catch (e) {
                console.debug('deleteItem: queueDelete(ulid) failed', e);
            }
        }
    }

    // 6. Fallback: Force Delete FileTree Entry (Ghost File Fix)
    // If the file is missing from storage providers, deleteTargets returns empty msgs (Code 18).
    // We need to manually construct the FileTree deletion message.
    try {
        console.debug('deleteItem: attempting Force Delete FileTree Entry for', cleanPath);
        
        // We need access to the reader to look up ULIDs and Refs
        // handler.reader is protected but accessible in JS
        const reader = handler.reader;
        if (reader && typeof reader.ulidLookup === 'function' && typeof reader.findRefIndex === 'function') {
            
            const ulid = reader.ulidLookup(cleanPath);
            const ref = reader.findRefIndex(cleanPath);
            const parentUlid = reader.ulidLookup(parentPath);
            
            if (ulid && parentUlid && ref !== undefined) {
                console.debug('deleteItem: found FileTree details', { ulid, parentUlid, ref });
                
                const pkg = {
                    meta: await NullMetaHandler.create({
                        location: parentUlid,
                        refIndex: ref,
                        ulid: ulid
                    }),
                    aes: await genAesBundle()
                };
                
                if (typeof handler.filetreeDeleteToMsgs === 'function') {
                    const msgs = await handler.filetreeDeleteToMsgs(pkg);
                    if (msgs && msgs.length > 0) {
                        console.debug('deleteItem: broadcasting Force Delete msgs', msgs);
                        await withSignerLock(() => handler.jackalClient.broadcastAndMonitorMsgs(msgs));
                        return true;
                    }
                }
            } else {
                console.warn('deleteItem: could not find FileTree details for Force Delete', { ulid, parentUlid, ref });
            }
        }
    } catch (e) {
        console.warn('deleteItem: Force Delete failed', e);
    }

    throw new Error(`Failed to delete "${fileName}". The file might not exist on the chain or is corrupted.`);
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

// ------------------ File Sharing Helpers ------------------
export async function shareFile(handler, filePath, targetAddress, raw = null) {
    if (!handler || !filePath || !targetAddress) {
        throw new Error('Missing handler, filePath, or targetAddress for sharing');
    }

    const cleanPath = String(filePath || '').replace(/^s\//, '');
    
    try {
        // Get file metadata if not provided
        let fileMeta = raw && raw.fileMeta ? raw.fileMeta : null;
        
        if (!fileMeta && typeof handler.getFileMetaData === 'function') {
            try {
                fileMeta = await handler.getFileMetaData(cleanPath);
            } catch (e) {
                console.warn('shareFile: getFileMetaData failed', e);
            }
        }

        // Use grantViewerAccess if available (preferred method)
        if (typeof handler.grantViewerAccess === 'function') {
            console.debug('shareFile: granting viewer access to', targetAddress);
            await withSignerLock(() => handler.grantViewerAccess({
                path: cleanPath,
                address: targetAddress
            }));
            return { success: true, method: 'grantViewerAccess' };
        }

        // Fallback: Try shareFile method
        if (typeof handler.shareFile === 'function') {
            console.debug('shareFile: using shareFile method');
            await withSignerLock(() => handler.shareFile({
                path: cleanPath,
                viewer: targetAddress
            }));
            return { success: true, method: 'shareFile' };
        }

        // Fallback: Try addViewers
        if (typeof handler.addViewers === 'function') {
            console.debug('shareFile: using addViewers method');
            await withSignerLock(() => handler.addViewers({
                addresses: [targetAddress],
                ulid: fileMeta?.ulid || raw?.ulid
            }));
            return { success: true, method: 'addViewers' };
        }

        throw new Error('No sharing method available on StorageHandler');
    } catch (err) {
        console.error('shareFile failed:', err);
        throw err;
    }
}

export async function unshareFile(handler, filePath, targetAddress, raw = null) {
    if (!handler || !filePath || !targetAddress) {
        throw new Error('Missing handler, filePath, or targetAddress for unsharing');
    }

    const cleanPath = String(filePath || '').replace(/^s\//, '');
    
    try {
        // Get file metadata if not provided
        let fileMeta = raw && raw.fileMeta ? raw.fileMeta : null;
        
        if (!fileMeta && typeof handler.getFileMetaData === 'function') {
            try {
                fileMeta = await handler.getFileMetaData(cleanPath);
            } catch (e) {
                console.warn('unshareFile: getFileMetaData failed', e);
            }
        }

        // Use revokeViewerAccess if available (preferred method)
        if (typeof handler.revokeViewerAccess === 'function') {
            console.debug('unshareFile: revoking viewer access from', targetAddress);
            await withSignerLock(() => handler.revokeViewerAccess({
                path: cleanPath,
                address: targetAddress
            }));
            return { success: true, method: 'revokeViewerAccess' };
        }

        // Fallback: Try removeViewers
        if (typeof handler.removeViewers === 'function') {
            console.debug('unshareFile: using removeViewers method');
            await withSignerLock(() => handler.removeViewers({
                addresses: [targetAddress],
                ulid: fileMeta?.ulid || raw?.ulid
            }));
            return { success: true, method: 'removeViewers' };
        }

        throw new Error('No unsharing method available on StorageHandler');
    } catch (err) {
        console.error('unshareFile failed:', err);
        throw err;
    }
}

export async function getFileViewers(handler, filePath, raw = null) {
    if (!handler || !filePath) {
        throw new Error('Missing handler or filePath for getting viewers');
    }

    const cleanPath = String(filePath || '').replace(/^s\//, '');
    
    try {
        // Get file metadata if not provided
        let fileMeta = raw && raw.fileMeta ? raw.fileMeta : null;
        
        if (!fileMeta && typeof handler.getFileMetaData === 'function') {
            try {
                fileMeta = await handler.getFileMetaData(cleanPath);
            } catch (e) {
                console.warn('getFileViewers: getFileMetaData failed', e);
            }
        }

        // Try listViewers method
        if (typeof handler.listViewers === 'function') {
            const viewers = await handler.listViewers({
                ulid: fileMeta?.ulid || raw?.ulid
            });
            return Array.isArray(viewers) ? viewers : [];
        }

        // Try getViewers
        if (typeof handler.getViewers === 'function') {
            const viewers = await handler.getViewers(cleanPath);
            return Array.isArray(viewers) ? viewers : [];
        }

        // Check if fileMeta has viewers property
        if (fileMeta && fileMeta.viewers) {
            return Array.isArray(fileMeta.viewers) ? fileMeta.viewers : [];
        }

        return [];
    } catch (err) {
        console.warn('getFileViewers failed:', err);
        return [];
    }
}