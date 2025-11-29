/**
 * Storage status operations
 */

export async function getStorageStatus(handler) {
    if (!handler) return null;
    try {
        return await handler.planStatus();
    } catch (e) {
        return null;
    }
}
