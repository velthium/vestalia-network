/**
 * Legacy compatibility layer - re-exports from modular structure
 * @deprecated Import directly from @/lib/jackal instead
 */

export { 
  withSignerLock, 
  safeUpgradeSigner, 
  genAesBundle 
} from './jackal/utils.js';

export { loadDirectoryContents } from './jackal/read.js';
export { downloadFile } from './jackal/download.js';
export { uploadFile } from './jackal/upload.js';
export { deleteItem } from './jackal/delete.js';
export { renameItem } from './jackal/rename.js';
export { createNewFolder } from './jackal/folder.js';
export { getStorageStatus } from './jackal/storage.js';
