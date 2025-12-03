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

    // Check if this is a shared file (from another user)
    const isShared = raw && (raw.isSharedItem || raw.metaDataType === 'share');
    // For shared files: owner is in raw.owner (from IShareMetaData), or sharerAddress from vault page
    const ownerAddress = raw?.owner || raw?.sharerAddress;
    
    // Log full raw object for debugging
    console.log('downloadFile called with:', { 
        filePath, 
        cleanPath, 
        isShared, 
        ownerAddress,
        rawKeys: raw ? Object.keys(raw) : null,
        raw: raw
    });
    
    // For shared files, use the SDK's share download methods
    if (isShared && ownerAddress) {
        console.log('Downloading shared file - Full raw data:', JSON.stringify(raw, null, 2));
        
        // IShareMetaData structure (from SDK):
        // - pointsTo: ULID of the original file on the owner's storage
        // - owner: address of the file owner (sharer)
        // - ulid: ULID of the share metadata entry itself
        // - name: name of the shared file
        // - isFile: boolean
        // - location: location of the share metadata
        
        // The key insight: to download a shared file, we need:
        // 1. The original file's ULID (pointsTo) 
        // 2. The owner's address (owner)
        
        const originalFileUlid = raw.pointsTo; // This is the ULID of the actual file on owner's storage
        const shareMetadataUlid = raw.ulid;    // This is the ULID of the share metadata
        const fileName = raw.fileMeta?.name || raw.name || raw.whoAmI;
        
        console.log('Share metadata parsed:', {
            originalFileUlid,
            shareMetadataUlid,
            fileName,
            ownerAddress,
            metaDataType: raw.metaDataType
        });
        
        // Method 1: Use downloadByUlid with the ORIGINAL file's ULID (pointsTo)
        // The userAddress parameter should be the OWNER's address, not the current user
        if (originalFileUlid && typeof handler.downloadByUlid === 'function') {
            try {
                console.log('Trying downloadByUlid with pointsTo:', { 
                    ulid: originalFileUlid, 
                    userAddress: ownerAddress 
                });
                return await handler.downloadByUlid({
                    ulid: originalFileUlid,
                    trackers: tracker,
                    userAddress: ownerAddress  // Use OWNER's address, not current user
                });
            } catch (e) {
                console.warn('downloadByUlid with pointsTo failed:', e.message);
            }
        }
        
        // Method 2: Try with the share metadata ULID
        if (shareMetadataUlid && shareMetadataUlid !== originalFileUlid && typeof handler.downloadByUlid === 'function') {
            try {
                console.log('Trying downloadByUlid with share ulid:', { 
                    ulid: shareMetadataUlid, 
                    userAddress: ownerAddress 
                });
                return await handler.downloadByUlid({
                    ulid: shareMetadataUlid,
                    trackers: tracker,
                    userAddress: ownerAddress
                });
            } catch (e) {
                console.warn('downloadByUlid with share ulid failed:', e.message);
            }
        }
        
        // Method 3: Try downloadExternalFile with various path formats
        // downloadExternalFile(userAddress, filePath, trackers) - userAddress is the OWNER
        if (typeof handler.downloadExternalFile === 'function') {
            const pathsToTry = [];
            
            // If we have a filename, try common patterns
            if (fileName) {
                pathsToTry.push(`Home/${fileName}`);
                pathsToTry.push(fileName);
            }
            
            // Try with cleanPath variations
            pathsToTry.push(cleanPath);
            if (!cleanPath.startsWith('Home/')) {
                pathsToTry.push(`Home/${cleanPath}`);
            }
            
            // Remove duplicates and empty strings
            const uniquePaths = [...new Set(pathsToTry.filter(p => p && p.length > 0))];
            
            for (const tryPath of uniquePaths) {
                try {
                    console.log('Trying downloadExternalFile:', { ownerAddress, path: tryPath });
                    return await handler.downloadExternalFile(ownerAddress, tryPath, tracker);
                } catch (e) {
                    console.warn(`downloadExternalFile failed for path "${tryPath}":`, e.message);
                }
            }
        }
        
        // Method 4: Try using getMetaDataByUlid then download
        // This loads metadata first which may help with key derivation
        if (originalFileUlid && typeof handler.getMetaDataByUlid === 'function') {
            try {
                console.log('Trying getMetaDataByUlid + download:', { ulid: originalFileUlid, userAddress: ownerAddress });
                const fileMeta = await handler.getMetaDataByUlid({
                    ulid: originalFileUlid,
                    userAddress: ownerAddress
                });
                console.log('Got file metadata:', fileMeta);
                
                if (fileMeta && fileMeta.merkleHex) {
                    // Now try downloading by ULID again
                    return await handler.downloadByUlid({
                        ulid: originalFileUlid,
                        trackers: tracker,
                        userAddress: ownerAddress
                    });
                }
            } catch (e) {
                console.warn('getMetaDataByUlid approach failed:', e.message);
            }
        }
        
        // All shared file download methods failed
        console.error('All download attempts failed for shared file. Raw data:', raw);
        throw new Error('Could not download shared file. The file may no longer be shared with you.');
    }
    
    // For regular (non-shared) files
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
                console.log('Downloading own file by ULID:', { ulid: ulidStr, userAddress });
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
    
    // Final fallback: use standard downloadFile
    try {
        console.log('Trying standard downloadFile:', { cleanPath });
        return await handler.downloadFile(cleanPath, tracker);
    } catch (err) {
        console.error('handler.downloadFile failed:', err.message);
        throw err;
    }
}
