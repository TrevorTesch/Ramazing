/**
 * Client-side encryption for sensitive data
 * Uses CryptoJS for AES-256 encryption in the browser
 */

// Import CryptoJS (add <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script> to HTML)

const ENCRYPTION_PASSWORD = 'shadow-browser-local-encryption'; // User can override this

/**
 * Encrypt and store data in localStorage
 * @param {string} key - Storage key
 * @param {object} data - Data to encrypt and store
 */
export function encryptAndStore(key, data) {
    try {
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_PASSWORD).toString();
        localStorage.setItem(key, encrypted);
        return true;
    } catch (error) {
        console.error('Encryption failed:', error);
        return false;
    }
}

/**
 * Retrieve and decrypt data from localStorage
 * @param {string} key - Storage key
 * @returns {object|null} - Decrypted data or null if fails
 */
export function decryptAndRetrieve(key) {
    try {
        const encrypted = localStorage.getItem(key);
        if (!encrypted) return null;
        
        const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_PASSWORD);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(decrypted);
    } catch (error) {
        console.error('Decryption failed:', error);
        return null;
    }
}

/**
 * Set custom encryption password
 * @param {string} password - New encryption password
 */
export function setEncryptionPassword(password) {
    ENCRYPTION_PASSWORD = password;
    sessionStorage.setItem('enc_pwd', CryptoJS.SHA512(password).toString());
}

/**
 * Clear sensitive data from memory and storage
 */
export function clearSensitiveData() {
    const sensitiveKeys = ['bookmarks', 'history', 'settings', 'tokens'];
    sensitiveKeys.forEach(key => localStorage.removeItem(key));
}
