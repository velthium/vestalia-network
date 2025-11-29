/**
 * Folder creation operations
 */

export async function createNewFolder(handler, parentPath, folderName) {
    if (!handler || !folderName || !parentPath) {
        throw new Error("Missing handler, path, or folder name.");
    }
    await handler.createFolders({ parentPath: parentPath, names: [folderName] });
}
