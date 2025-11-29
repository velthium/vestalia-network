/**
 * Directory reading operations
 */

export async function loadDirectoryContents(handler, path, ownerCandidates = []) {
    const tried = [];
    let result = null;

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

        if (handler && handler.client && handler.client.details && handler.client.details.address) {
            ownerCandidates.push(handler.client.details.address);
        }
        if (handler && handler.jackalClient && typeof handler.jackalClient.getJackalAddress === 'function') {
            try { ownerCandidates.push(await handler.jackalClient.getJackalAddress()); } catch (e) {}
        }
    }

    ownerCandidates = Array.from(new Set(ownerCandidates.filter(Boolean)));

    let lookupPath = typeof path === 'string' ? path : '';
    lookupPath = lookupPath.replace(/^\/?s(\/?|$)/, '');

    for (const owner of ownerCandidates) {
        tried.push(owner);
        if (typeof handler.readDirectoryContents === 'function') {
            try {
                const res = await handler.readDirectoryContents(lookupPath, { owner, refresh: true });
                // eslint-disable-next-line no-console
                result = res;
            } catch (e) {
                // eslint-disable-next-line no-console
                result = null;
            }
        }
        if (result && (result.folders || result.files)) break;
    }

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

    if ((!result || (Object.keys(result || {}).length === 0)) && tried.length > 0) {
        // eslint-disable-next-line no-console
    }

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

    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.children)) return result.children;

    return [];
}
