import { withSignerLock } from './utils.js';

/**
 * File sharing operations using Jackal SDK shareDirect method
 */

export async function shareFile(handler, filePath, targetAddress, raw = null) {
    if (!handler || !filePath || !targetAddress) {
        throw new Error('Missing handler, filePath, or targetAddress for sharing');
    }

    // Remove 's/', 's/Home/', or just 'Home/' prefix
    let cleanPath = String(filePath || '')
        .replace(/^s\/Home\//, '')
        .replace(/^s\//, '')
        .replace(/^Home\//, '');
    
    try {
        console.log('Sharing file with path:', cleanPath);
        
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

    // Remove 's/', 's/Home/', or just 'Home/' prefix to get clean path
    // IMPORTANT: This must match EXACTLY what shareFile uses
    let cleanPath = String(filePath || '')
        .replace(/^s\/Home\//, '')
        .replace(/^s\//, '')
        .replace(/^Home\//, '');
    
    // Get the parent directory path (without the file name) for loading
    const pathParts = cleanPath.split('/');
    const fileName = pathParts.pop();
    const parentPath = pathParts.length > 0 ? pathParts.join('/') : '';
    
    // Try to get the file's ULID from raw metadata
    let fileId = null;
    if (raw && (raw.ulid || raw.fileMeta?.ulid)) {
        const ulid = raw.ulid || raw.fileMeta?.ulid;
        fileId = typeof ulid === 'string' ? ulid : ulid.toString();
    }
    
    try {
        console.log('Unsharing file:', {
            originalPath: filePath,
            cleanPath,
            fileName,
            parentPath,
            fileId,
            targetAddress,
        });
        
        // CRITICAL: The SDK's unshare() -> sendUnshareToMsgs() calls reader.ulidLookup(path)
        // which looks up in ulidLeaves[ownerAddress][path].
        // This cache is populated when readFolderContents or pathToLookup is called.
        //
        // When shareDirect is called with "filename.jpg", it internally does:
        // 1. prepShare(pkg) with pkg.path = "filename.jpg"
        // 2. reader.readFolderContents("filename.jpg") - this might fail (not a folder)
        // 3. On fail, it treats it as a file and loads meta directly
        // 
        // The key is that after loadDirectory/readDirectoryContents, the ulidLeaves
        // should contain "Home/filename.jpg" -> ulid mapping.
        
        // Step 1: Load the parent directory (Home or subdirectory) to populate the cache
        const parentToLoad = parentPath || 'Home';
        console.log('Step 1: Loading directory contents for:', parentToLoad);
        
        if (typeof handler.readDirectoryContents === 'function') {
            try {
                const contents = await handler.readDirectoryContents(parentToLoad, { refresh: true });
                console.log('Directory contents loaded:', {
                    path: parentToLoad,
                    fileCount: contents?.files ? Object.keys(contents.files).length : 0,
                    folderCount: contents?.folders ? Object.keys(contents.folders).length : 0,
                });
            } catch (readErr) {
                console.warn('readDirectoryContents failed:', readErr.message);
            }
        }
        
        // Step 2: Use findUlid to check which path format works
        // This tells us what path the SDK actually has in its cache
        const pathVariations = [
            cleanPath,                                    // e.g., "filename.jpg"
            fileName,                                     // e.g., "filename.jpg"  
            `Home/${cleanPath}`,                          // e.g., "Home/filename.jpg"
            `Home/${fileName}`,                           // e.g., "Home/filename.jpg"
            parentPath ? `${parentPath}/${fileName}` : fileName,  // e.g., "subdir/filename.jpg"
        ];
        
        // Remove duplicates
        const uniqueVariations = [...new Set(pathVariations)].filter(Boolean);
        
        let workingPath = null;
        for (const pathVar of uniqueVariations) {
            try {
                if (typeof handler.findUlid === 'function') {
                    const foundUlid = handler.findUlid(pathVar);
                    console.log(`findUlid("${pathVar}") = "${foundUlid}"`);
                    workingPath = pathVar;
                    break;
                }
            } catch (e) {
                console.log(`findUlid("${pathVar}") failed: ${e.message}`);
            }
        }
        
        if (workingPath) {
            console.log('Found working path for ulidLookup:', workingPath);
        } else {
            console.warn('Could not find file in ulidLeaves cache with any path variation');
        }
        
        // Step 3: Try unshare with the paths we found
        // The SDK's unshare passes the path directly to sendUnshareToMsgs which calls ulidLookup
        const pathsToTry = workingPath 
            ? [workingPath, ...uniqueVariations.filter(p => p !== workingPath)]
            : uniqueVariations;
        
        let lastError = null;
        for (const pathAttempt of pathsToTry) {
            try {
                console.log('Trying unshare with path:', pathAttempt);
                const result = await withSignerLock(() => handler.unshare({
                    receivers: [targetAddress],
                    paths: pathAttempt
                }));
                console.log('✓ unshare succeeded with path:', pathAttempt, 'result:', result);
                
                return { success: true, method: 'unshare', usedPath: pathAttempt };
            } catch (err) {
                const errMsg = err?.message || String(err);
                console.warn(`unshare failed with path "${pathAttempt}":`, errMsg);
                lastError = err;
                
                // If it's not a "No Resource Found" error, don't try other paths
                if (!errMsg.includes('No Resource Found')) {
                    throw err;
                }
            }
        }
        
        // All attempts failed
        throw lastError || new Error('All unshare attempts failed');
        
    } catch (err) {
        console.error('Unshare failed - full error:', err);
        
        // Extract error message from various possible formats
        let errorMsg = 'Unknown error';
        if (err instanceof Error) {
            errorMsg = err.message;
        } else if (typeof err === 'string') {
            errorMsg = err;
        } else if (err && typeof err === 'object') {
            errorMsg = err.message || err.error || err.reason || err.rawLog || JSON.stringify(err);
        }
        
        const fullErrMsg = `Failed to revoke access: ${errorMsg}. Path: ${cleanPath}${fileId ? ', ULID: ' + fileId : ''}`;
        throw new Error(fullErrMsg);
    }
}

export async function getFileViewers(handler, filePath, raw = null) {
    if (!handler || !filePath) {
        throw new Error('Missing handler or filePath for getting viewers');
    }

    // Remove 's/', 's/Home/', or just 'Home/' prefix
    let cleanPath = String(filePath || '')
        .replace(/^s\/Home\//, '')
        .replace(/^s\//, '')
        .replace(/^Home\//, '');
    
    try {
        console.log('Getting file viewers for:', { cleanPath, raw });
        
        // Try to get the file's ULID from raw metadata
        let fileId = null;
        if (raw && (raw.ulid || raw.fileMeta?.ulid)) {
            const ulid = raw.ulid || raw.fileMeta?.ulid;
            fileId = typeof ulid === 'string' ? ulid : ulid.toString();
        }
        
        // Method 1: Try using readViewerShares with ULID (most reliable)
        if (fileId && handler.reader && typeof handler.reader.readViewerShares === 'function') {
            try {
                console.log('Trying readViewerShares with ULID:', fileId);
                const viewers = handler.reader.readViewerShares(fileId);
                console.log('readViewerShares returned:', viewers);
                return Array.isArray(viewers) ? viewers : [];
            } catch (e) {
                console.warn('readViewerShares failed:', e.message);
            }
        }
        
        // Method 2: Use checkSharedTo with path
        if (typeof handler.checkSharedTo === 'function') {
            try {
                console.log('Trying checkSharedTo with path:', cleanPath);
                const viewers = await handler.checkSharedTo(cleanPath);
                console.log('checkSharedTo returned:', viewers);
                return Array.isArray(viewers) ? viewers : [];
            } catch (e) {
                console.warn('checkSharedTo failed:', e.message);
                // File might not be shared yet, return empty array
                return [];
            }
        }
        
        return [];
    } catch (err) {
        console.error('Error getting file viewers:', err);
        // Return empty array instead of throwing to prevent UI errors
        return [];
    }
}
