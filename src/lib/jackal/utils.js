import { NullMetaHandler } from '@jackallabs/jackal.js';

/**
 * Shared utilities for Jackal operations
 */

// --- Constants ---
export const JACKAL_ROOT = ["s", "Home"];

// Simple in-memory mutex to serialize signer actions (prevents concurrent Keplr signature popups)
let _signerLock = false;
export async function withSignerLock(fn) {
    while (_signerLock) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 50));
    }
    _signerLock = true;
    try {
        return await fn();
    } finally {
        _signerLock = false;
    }
}

export async function genAesBundle() {
    const key = new Uint8Array(32);
    const iv = new Uint8Array(16);
    if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(key);
        window.crypto.getRandomValues(iv);
    } else {
        for(let i=0; i<32; i++) key[i] = Math.floor(Math.random() * 256);
        for(let i=0; i<16; i++) iv[i] = Math.floor(Math.random() * 256);
    }
    return { key, iv };
}

// Safe upgrade helper: call handler.upgradeSigner() but swallow user-rejected errors
export async function safeUpgradeSigner(handler) {
    if (!handler || typeof handler.upgradeSigner !== 'function') return false;
    return await withSignerLock(async () => {
        try {
            await handler.upgradeSigner();
            return true;
        } catch (e) {
            const msg = e && e.message ? e.message : String(e || '');
            if (/request rejected|user rejected/i.test(msg)) {
                // eslint-disable-next-line no-console
                console.debug('safeUpgradeSigner: user rejected signer request');
                return false;
            }
            // eslint-disable-next-line no-console
            console.debug('safeUpgradeSigner: upgradeSigner failed:', msg);
            return false;
        }
    });
}
