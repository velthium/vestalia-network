import { withSignerLock } from './utils.js';

/**
 * File sharing operations using Jackal SDK shareDirect method
 */

export async function shareFile(handler, filePath, targetAddress, raw = null) {
    if (!handler || !filePath || !targetAddress) {
        throw new Error('Missing handler, filePath, or targetAddress for sharing');
    }

    const cleanPath = String(filePath || '').replace(/^s\//, '');
    
    try {
        
        // Use the shareDirect method from Jackal SDK
        await withSignerLock(() => handler.shareDirect({
            receiver: targetAddress,
            paths: cleanPath
        }));
        
        return { success: true, method: 'shareDirect' };
    } catch (err) {
        throw err;
    }
}

export async function unshareFile(handler, filePath, targetAddress, raw = null) {
    if (!handler || !filePath || !targetAddress) {
        throw new Error('Missing handler, filePath, or targetAddress for unsharing');
    }

    const cleanPath = String(filePath || '').replace(/^s\//, '');
    
    try {
        
        // Use the unshare method from Jackal SDK
        await withSignerLock(() => handler.unshare({
            receivers: [targetAddress],
            paths: cleanPath
        }));
        
        return { success: true, method: 'unshare' };
    } catch (err) {
        throw err;
    }
}

export async function getFileViewers(handler, filePath, raw = null) {
    if (!handler || !filePath) {
        throw new Error('Missing handler or filePath for getting viewers');
    }

    const cleanPath = String(filePath || '').replace(/^s\//, '');
    
    try {
        
        // Use checkSharedTo to get list of viewers
        if (typeof handler.checkSharedTo === 'function') {
            const viewers = await handler.checkSharedTo(cleanPath);
            return Array.isArray(viewers) ? viewers : [];
        }
        
        return [];
    } catch (err) {
        return [];
    }
}
