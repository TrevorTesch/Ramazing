import { encryptData, decryptData, hashPassword, verifyPassword } from './lib/crypto.js';
const mySecretUrl = encryptData("https://example.com/secret-page");
console.log("Encrypted URL:", mySecretUrl);