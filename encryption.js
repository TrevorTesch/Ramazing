import crypto from 'node:crypto';

/**
 * 1. ENCODE DATA (For Tabs/URLs)
 * We use Base64 here because the ShadowV3 frontend can read it easily.
 * This will fix the "Tabs won't open" issue.
 */
export function encryptData(data) {
    try {
        return Buffer.from(data).toString('base64');
    } catch (error) {
        console.error('Encoding error:', error);
        return null;
    }
}

/**
 * 2. DECODE DATA (For Tabs/URLs)
 */
export function decryptData(encodedString) {
    try {
        return Buffer.from(encodedString, 'base64').toString('utf8');
    } catch (error) {
        console.error('Decoding error:', error);
        return null;
    }
}

/**
 * 3. HASH PASSWORD (Keep this secure!)
 * This stays on the server, so it can remain high-security.
 */
export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

/**
 * 4. VERIFY PASSWORD
 */
export function verifyPassword(password, storedHash) {
    try {
        const [salt, originalHash] = storedHash.split(':');
        const hashToVerify = crypto.scryptSync(password, salt, 64);
        return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), hashToVerify);
    } catch (error) {
        return false;
    }
}

/**
 * 5. GENERATE TOKEN
 */
export function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}