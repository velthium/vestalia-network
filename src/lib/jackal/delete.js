import { NullMetaHandler } from '@jackallabs/jackal.js';
import { withSignerLock, genAesBundle } from './utils.js';

/**
 * File and folder deletion operations
 */

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
