import { encryptData, decryptData, hashPassword, verifyPassword } from './lib/crypto.js';
const mySecretUrl = encryptData("https://crazygames.com");
console.log("Encrypted URL:", mySecretUrl);