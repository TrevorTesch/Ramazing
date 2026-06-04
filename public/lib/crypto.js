import crypto from 'node:crypto';

/**
 * CONFIGURATION
 * The ENCRYPTION_KEY must be exactly 32 characters for AES-256.
 * It is pulled from your .env file in ShadowV3.
 */
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-secret-key-32-chars-long!'; 
const IV_LENGTH = 16; 

/**
 * Encrypts data (URLs, Settings, etc.)
 * Fixed: Now uses a random Initialization Vector (IV) for every encryption.
 */
export function encryptData(data) {
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        
        let encrypted = cipher.update(JSON.stringify(data));
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        // Returns IV and Data together, separated by a colon
        return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
    } catch (error) {
        console.error('Encryption Failure:', error);
        return null;
    }
}

/**
 * Decrypts data 
 * Reverses the AES-256-CBC encryption.
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
 * Hashes a password securely
 * Fixed: Uses Scrypt + Salt instead of SHA-512 to prevent brute-force attacks.
 */
export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored hash
 * Fixed: Uses timingSafeEqual to prevent side-channel timing attacks.
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
 * Generates a secure random token
 */
export function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}