/**
 * File download operations
 */

async function ensureProviderPool(handler) {
    // Check if provider pool is already loaded
    try {
        // Try to get current providers - if this works, pool is loaded
        if (handler.providers && handler.providers.length > 0) {
            return true;
        }
    } catch (e) {
        // Pool not loaded, continue to load it
    }
    
    // Load provider pool
    try {
        const availableProviders = await handler.getAvailableProviders();
        if (!availableProviders || availableProviders.length === 0) {
            console.warn('No available providers returned from getAvailableProviders');
            return false;
        }
        const providerIps = await handler.findProviderIps(availableProviders);
        if (!providerIps || providerIps.length === 0) {
            console.warn('No provider IPs found');
            return false;
        }
        await handler.loadProviderPool(providerIps);
        console.log('Provider pool loaded successfully with', providerIps.length, 'providers');
        return true;
    } catch (e) {
        console.error('Failed to load provider pool:', e.message);
        return false;
    }
}

export async function downloadFile(handler, filePath, tracker, raw) {
    // Remove 's/' prefix if present
    let cleanPath = filePath.replace(/^s\//, '');
    
    // Ensure tracker exists as it is required by the SDK
    if (!tracker) {
        tracker = { progress: 0, chunks: [] };
    }
    
    // Ensure provider pool is loaded before attempting download
    const poolLoaded = await ensureProviderPool(handler);
    if (!poolLoaded) {
        throw new Error('Unable to connect to storage providers. Please try again later.');
    }
    
    // Try downloadByUlid first if available
    const ulidCandidate = raw ? (raw.ulid || raw.fileMeta?.ulid || raw.cid || raw.fid) : null;
    
    if (ulidCandidate && typeof handler.downloadByUlid === 'function') {
        try {
            const ulidStr = typeof ulidCandidate === 'string' ? ulidCandidate : ulidCandidate.toString();
            
            let userAddress = null;
            try {
                if (handler.jackalClient && typeof handler.jackalClient.getJackalAddress === 'function') {
                    userAddress = await handler.jackalClient.getJackalAddress();
                } else if (handler.client && handler.client.details && handler.client.details.address) {
                    userAddress = handler.client.details.address;
                } else if (handler.walletHandler && handler.walletHandler.address) {
                    userAddress = handler.walletHandler.address;
                }
            } catch (addrErr) {
                console.warn('Error getting user address:', addrErr.message);
            }

            if (userAddress) {
                console.log('Downloading file by ULID:', { ulid: ulidStr, userAddress });
                return await handler.downloadByUlid({
                    ulid: ulidStr,
                    trackers: tracker,
                    userAddress: userAddress
                });
            } else {
                console.warn('Could not determine user address, skipping downloadByUlid');
            }
        } catch (e) {
            console.warn('downloadByUlid failed:', e.message);
        }
    }
    
    // Fallback: use standard downloadFile
    try {
        console.log('Trying standard downloadFile:', { cleanPath });
        return await handler.downloadFile(cleanPath, tracker);
    } catch (err) {
        console.error('handler.downloadFile failed:', err.message);
        throw err;
    }
}
