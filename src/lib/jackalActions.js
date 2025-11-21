/**
 * Contains functions for interacting with the Jackal StorageHandler.
 */

// --- Constants ---
const JACKAL_ROOT = ["s", "Home"];

// --- Read Functions ---

/**
 * Loads the contents of a directory using the most robust method for the SDK version.
 * @param {object} handler - The StorageHandler instance.
 * @param {string} path - The directory path (e.g., "s/Home/Documents").
 * @returns {Promise<Array>} The list of files and folders.
 */
export async function loadDirectoryContents(handler, path, ownerCandidates = []) {
    // Try reading folder contents using several possible owner addresses (ICA mounts, owner, etc.)
    const tried = [];
    let result = null;

    // build candidate owners from handler if none provided
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

        // common fallback properties
        if (handler && handler.client && handler.client.details && handler.client.details.address) {
            ownerCandidates.push(handler.client.details.address);
        }
        if (handler && handler.jackalClient && typeof handler.jackalClient.getJackalAddress === 'function') {
            try { ownerCandidates.push(await handler.jackalClient.getJackalAddress()); } catch (e) {}
        }
    }

    // dedupe
    ownerCandidates = Array.from(new Set(ownerCandidates.filter(Boolean)));

    // Normalize path: some SDK versions expect paths without the storage prefix 's'
    let lookupPath = typeof path === 'string' ? path : '';
    // remove leading slash and optional storage prefix `s` (examples: 's/Home', '/s/Home' -> 'Home')
    lookupPath = lookupPath.replace(/^\/?s(\/|$)/, '');

    // Try reading with explicit owner candidates first
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

    // If still nothing, fallback to generic read/load
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

    // If still empty, log debug information to help diagnose mount/owner issues
    if ((!result || (Object.keys(result || {}).length === 0)) && tried.length > 0) {
        // expose the tried owner list for easier debugging
        // eslint-disable-next-line no-console
        console.debug("loadDirectoryContents: no result, tried owners:", tried, "handler.children:", handler && handler.children);
    }

    // Normalize known shapes (folders/files maps) into an array of items
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

    // Older SDK shapes: children array or directory.children
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.children)) return result.children;

    return [];
}

/**
 * Downloads and decrypts a file, returning a Blob.
 * @param {object} handler - The StorageHandler instance.
 * @param {string} filePath - The full path of the file to download.
 * @returns {Promise<Blob>} The decrypted file data.
 */
export async function downloadFile(handler, filePath) {
    return await handler.downloadFile(filePath);
}

// --- Write/Action Functions ---

/**
 * Creates a new directory entry (folder).
 * @param {object} handler - The StorageHandler instance.
 * @param {string} parentPath - The path where the folder will be created.
 * @param {string} folderName - The name of the new folder.
 */
export async function createNewFolder(handler, parentPath, folderName) {
    if (!handler || !folderName || !parentPath) {
        throw new Error("Missing handler, path, or folder name.");
    }
    
    // SDK expects `names` (not `folders`) according to storageHandler API
    await handler.createFolders({
        parentPath: parentPath,
        names: [folderName],
    });
}

/**
 * Queues and processes a file upload transaction.
 * @param {object} handler - The StorageHandler instance.
 * @param {File} file - The File object to upload.
 * @param {string} parentPath - The destination path.
 */
export async function uploadFile(handler, file, parentPath) {
    // Robust queuing: try multiple possible queue methods/signatures
    const tryQueue = async () => {
        // 1) queueFile(file, parentPath)
        if (typeof handler.queueFile === 'function') {
            try { await handler.queueFile(file, parentPath); return true; } catch (e) {}
            try { await handler.queueFile(file); return true; } catch (e) {}
        }

        // 2) queuePrivate(toQueue, duration?)
        if (typeof handler.queuePrivate === 'function') {
            try { await handler.queuePrivate(file, 0); return true; } catch (e) {}
            try { await handler.queuePrivate([file], 0); return true; } catch (e) {}
            try { await handler.queuePrivate(file); return true; } catch (e) {}
        }

        // 3) queuePublic
        if (typeof handler.queuePublic === 'function') {
            try { await handler.queuePublic(file, 0); return true; } catch (e) {}
            try { await handler.queuePublic([file], 0); return true; } catch (e) {}
            try { await handler.queuePublic(file); return true; } catch (e) {}
        }

        // 4) generic queue method names
        const altQueues = ['queue', 'addToQueue', 'enqueueFile'];
        for (const q of altQueues) {
            if (typeof handler[q] === 'function') {
                try { await handler[q](file, parentPath); return true; } catch (e) {}
                try { await handler[q](file); return true; } catch (e) {}
            }
        }

        return false;
    };

    const queued = await tryQueue();
    if (!queued) throw new Error('No queue method available on StorageHandler');

    // Process queue: try processQueue, processAllQueues, processPending, etc.
    if (typeof handler.processQueue === 'function') {
        // Refresh signer/state before processing to avoid sequence mismatches
        try {
            if (typeof handler.upgradeSigner === 'function') await handler.upgradeSigner();
        } catch (e) {
            // ignore upgrade failures
        }

        try {
            await handler.processQueue();
            return;
        } catch (procErr) {
            const msg = procErr && procErr.message ? procErr.message : String(procErr);
            if (/account sequence mismatch|incorrect account sequence|code 32/i.test(msg)) {
                // Try one resync + retry
                try {
                    if (typeof handler.upgradeSigner === 'function') await handler.upgradeSigner();
                    await handler.processQueue();
                    return;
                } catch (retryErr) {
                    // fall through to other processors or final failure
                    // eslint-disable-next-line no-console
                    console.debug('uploadFile: processQueue retry failed:', retryErr && retryErr.message ? retryErr.message : retryErr);
                }
            }
            throw procErr;
        }
    }
    if (typeof handler.processAllQueues === 'function') {
        try {
            if (typeof handler.upgradeSigner === 'function') await handler.upgradeSigner();
        } catch (e) {}
        await handler.processAllQueues();
        return;
    }
    if (typeof handler.processPending === 'function') {
        await handler.processPending();
        return;
    }
    if (typeof handler.processPendingNotifications === 'function') {
        await handler.processPendingNotifications();
        return;
    }
    // last resort: call saveFolder or similar if present (but we prefer queue processing)
    if (typeof handler.saveFolder === 'function') {
        try { await handler.saveFolder(); return; } catch (e) {}
    }
    // If no processor found, still return (queue may be processed elsewhere)
    return;
}

// TODO: Add deleteResource, moveRenameResource, etc.

/**
 * Attempt to delete a file or folder using best-effort method names supported by the handler.
 * @param {object} handler
 * @param {string} fullPath - full path to the item (e.g. "s/Home/Folder/File.txt")
 * @param {boolean} isDir
 */
export async function deleteItem(handler, fullPath, isDir = false) {
    if (!handler || !fullPath) throw new Error('Missing handler or path for delete');

    // Try file-delete variants
    const fileMethods = [
        'deleteFile',
        'deleteFiles',
        'removeFile',
        'removeFiles',
        'queueDelete',
        'delete',
    ];

    const folderMethods = [
        'deleteFolder',
        'deleteFolders',
        'removeFolder',
        'removeFolders',
        'rmdir',
        'delete',
    ];

    const tryList = isDir ? folderMethods : fileMethods;

    for (const m of tryList) {
        if (typeof handler[m] === 'function') {
            try {
                // Some methods accept array, some single path, some (path, opts)
                if (m.endsWith('s')) {
                    await handler[m]([fullPath]);
                } else if (m === 'queueDelete') {
                    await handler.queueDelete(fullPath);
                    if (typeof handler.processQueue === 'function') await handler.processQueue();
                } else {
                    await handler[m](fullPath);
                }

                return true;
            } catch (err) {
                // try next
                // eslint-disable-next-line no-console
                console.debug(`deleteItem: method ${m} failed:`, err && err.message ? err.message : err);
            }
        }
    }
    // Try well-known StorageHandler API: deleteTargets
    if (typeof handler.deleteTargets === 'function') {
        try {
            // try object signature
            await handler.deleteTargets({ targets: [fullPath] });
            return true;
        } catch (e1) {
            try {
                // try array signature
                await handler.deleteTargets([fullPath]);
                return true;
            } catch (e2) {
                try {
                    // try single-arg
                    await handler.deleteTargets(fullPath);
                    return true;
                } catch (e3) {
                    // fall through to final error
                    console.debug('deleteItem: deleteTargets attempts failed', e1, e2, e3);
                }
            }
        }
    }

    throw new Error('Delete not supported by StorageHandler (tried standard and fallback methods)');
}

/**
 * Attempt to rename/move an item. Best-effort sequence of method names.
 * @param {object} handler
 * @param {string} oldFullPath
 * @param {string} newFullPathOrName - either target full path or new name
 * @param {boolean} isDir
 */
export async function renameItem(handler, oldFullPath, newFullPathOrName, isDir = false, raw = null) {
    if (!handler || !oldFullPath || !newFullPathOrName) throw new Error('Missing args for rename');

    // If the provided new value looks like a full path (contains /), use it; otherwise compute sibling path
    const isFullPath = newFullPathOrName.includes('/');
    let targetPath = newFullPathOrName;
    if (!isFullPath) {
        const parts = oldFullPath.split('/');
        parts.pop();
        parts.push(newFullPathOrName);
        targetPath = parts.join('/');
    }

    // normalize oldFullPath for SDK calls (strip leading storage prefix 's')
    const lookupOld = typeof oldFullPath === 'string' ? oldFullPath.replace(/^\/?s(\/|$)/, '') : oldFullPath;
    const lookupTarget = typeof targetPath === 'string' ? targetPath.replace(/^\/?s(\/|$)/, '') : targetPath;

    const moveMethods = [
        'move',
        'moveFile',
        'moveFolder',
        'rename',
        'renameFile',
        'renameFolder',
    ];

    for (const m of moveMethods) {
        if (typeof handler[m] === 'function') {
            try {
                // signature variations: (old, new) or (path, newName)
                if (m === 'renameFile' || m === 'renameFolder' || m === 'rename') {
                    // try oldFullPath, target name
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

    // If this is a file, prefer copy-then-delete fallback first (some SDKs don't support moveRenameResource for files)
            if (!isDir) {
        try {
            if (typeof handler.downloadFile === 'function') {
                // attempt copy (download + upload) as a reliable rename for files
                const blob = await handler.downloadFile(lookupOld);
                const name = lookupTarget.split('/').pop();
                const file = new File([blob], name);
                const parent = lookupTarget.split('/').slice(0, -1).join('/');
                await uploadFile(handler, file, parent);
                await deleteItem(handler, lookupOld, false);
                return true;
            }
        } catch (copyErr) {
            // eslint-disable-next-line no-console
            console.debug('renameItem: copy-then-delete early attempt failed:', copyErr && copyErr.message ? copyErr.message : copyErr);
            // continue to try moveRenameResource below
        }
    }

    // Try StorageHandler's moveRenameResource if available (several possible signatures)
    if (typeof handler.moveRenameResource === 'function') {
        try {
            // Build IMoveRenameTarget shape
            const targetName = targetPath.split('/').pop();
            const location = targetPath.split('/').slice(0, -1).join('/');
            // Ensure we have proper file/folder metadata and ref if possible
            let fileMeta = raw && raw.fileMeta ? raw.fileMeta : null;
            let folderMeta = raw && raw.folderMeta ? raw.folderMeta : null;
            try {
                if (!fileMeta && !isDir && typeof handler.getFileMetaData === 'function') {
                    // try to fetch live metadata for this file
                    // oldFullPath may include the parent; use it
                    // eslint-disable-next-line no-await-in-loop
                    fileMeta = await handler.getFileMetaData(oldFullPath).catch(() => null);
                }
            } catch (e) {
                // ignore
            }

            try {
                if (!folderMeta && isDir && typeof handler.getFolderDetailsByUlid === 'function') {
                    // try to fetch folder details by ULID (if raw contains one)
                    const ulid = raw && (raw.ulid || raw.ulid?.toString() || raw.ulid?.ulid);
                    if (ulid) {
                        // eslint-disable-next-line no-await-in-loop
                        folderMeta = await handler.getFolderDetailsByUlid({ ulid }).catch(() => null);
                    }
                }
            } catch (e) {
                // ignore
            }

            // If still missing metadata, try listing children in current folder and match by name
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

            // Determine parent location (current folder id) if available
            let parentLocation = null;
            try {
                if (typeof handler.readCurrentLocation === 'function') parentLocation = handler.readCurrentLocation();
            } catch (e) {}

            // Build strict IMoveRenameTarget according to docs
            const moveTarget = {
                name: targetName,
                ref: (fileMeta && fileMeta.ref) || (folderMeta && folderMeta.ref) || (raw && raw.ref) || 0,
            };

            if (parentLocation) moveTarget.location = parentLocation;

            if (isDir) {
                // folder metadata MUST be an IFolderMetaData
                if (folderMeta) moveTarget.folder = folderMeta;
                else if (raw && raw.folder) moveTarget.folder = raw.folder;
                else if (raw) moveTarget.folder = raw;
            } else {
                // file metadata MUST be an IFileMetaData
                if (fileMeta) moveTarget.file = fileMeta;
                else if (raw && raw.fileMeta) moveTarget.file = raw.fileMeta;
                else if (raw) moveTarget.file = raw;
            }

            // Validate required fields for moveRenameResource
            const hasValidTarget = (isDir && !!moveTarget.folder) || (!isDir && !!moveTarget.file);
            if (!hasValidTarget) {
                // For files we already tried copy-then-delete earlier; for folders, cannot proceed
                throw new Error('IMoveRenameTarget construction failed: missing file/folder metadata');
            }

            // Call canonical API with wrapper object as documented
            try {
                // eslint-disable-next-line no-console
                console.debug('renameItem: calling moveRenameResource with targets:', moveTarget);
                await handler.moveRenameResource({ targets: [moveTarget] });
                return true;
            } catch (errMove) {
                // eslint-disable-next-line no-console
                console.debug('renameItem: moveRenameResource failed:', errMove && errMove.message ? errMove.message : errMove);
                throw errMove;
            }
        } catch (e1) {
            console.debug('renameItem: moveRenameResource unexpected failure', e1);
        }
    }

    // As a last resort, try copying + deleting (not ideal, but sometimes available): download then upload
    if (typeof handler.downloadFile === 'function') {
        try {
            const blob = await handler.downloadFile(oldFullPath);
            // create a File-like object if necessary
            const name = targetPath.split('/').pop();
            const file = new File([blob], name);
            const parent = targetPath.split('/').slice(0, -1).join('/');
            await uploadFile(handler, file, parent);
            // then delete the old
            await deleteItem(handler, oldFullPath, isDir);
            return true;
        } catch (err) {
            // eslint-disable-next-line no-console
            console.debug('renameItem: copy-then-delete fallback failed:', err && err.message ? err.message : err);
        }
    }

    throw new Error('Rename/Move not supported by StorageHandler');
}

/**
 * Debug helper: return the raw filetree structure for the given path.
 * Tries reader/readDirectoryContents with owner if available, then falls back to loadDirectory.
 */
// Note: Removed debug helper `dumpFiletree` — prefer `loadDirectoryContents` for production.