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
