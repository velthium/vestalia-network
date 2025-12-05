/**
 * File download operations
 */

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
        }
    } catch (e) {
        console.warn('Failed to load provider pool:', e.message);
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
