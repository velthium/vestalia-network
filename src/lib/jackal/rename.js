import { safeUpgradeSigner } from './utils.js';
import { uploadFile } from './upload.js';
import { deleteItem } from './delete.js';

/**
 * File and folder rename/move operations
 */

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
