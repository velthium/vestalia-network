import { withSignerLock } from './utils.js';

/**
 * File sharing operations
 */

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
