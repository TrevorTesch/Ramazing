import crypto from 'node:crypto';

/**
 * CONFIGURATION
 * The key MUST be 32 characters long for AES-256.
 */
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-secret-key-32-chars-long!'; 
const IV_LENGTH = 16; 

/**
 * 1. ENCRYPT DATA
 * Fixes the "No IV" error in your original code.
 */
export function encryptData(data) {
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        
        let encrypted = cipher.update(JSON.stringify(data));
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        // Output format is iv:encryptedData
        return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
    } catch (error) {
        console.error('Encryption Failure:', error);
        return null;
    }
}

/**
 * 2. DECRYPT DATA
 * Reverses the encryption.
 */
export function decryptData(encryptedString) {
    try {
        const [ivHex, encryptedHex] = encryptedString.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const encryptedText = Buffer.from(encryptedHex, 'hex');
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return JSON.parse(decrypted.toString());
    } catch (error) {
        console.error('Decryption Failure:', error);
        return null;
    }
}

/**
 * 3. HASH PASSWORD
 * Fixes the "SHA-512 is too fast" security error.
 */
export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

/**
 * 4. VERIFY PASSWORD
 * Fixes the "Timing Attack" vulnerability using timingSafeEqual.
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
 * Generates a secure random ID for sessions.
 */
export function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}