import crypto from "crypto";
import { CONFIG } from "../config/flavour.js";

// Encrypt a password using AES-256-CBC.
const encryptPassword = (password) => {
    const algorithm = "aes-256-cbc";
    const key = crypto.createHash("sha256").update(CONFIG.APP_SECRET).digest();
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(password, "utf8", "hex");
    encrypted += cipher.final("hex");

    return iv.toString("hex") + ":" + encrypted;
};

// Decrypt a password encrypted with encryptPassword.
const decryptPassword = (encryptedPassword) => {
    const algorithm = "aes-256-cbc";
    const key = crypto.createHash("sha256").update(CONFIG.APP_SECRET).digest();

    const parts = encryptedPassword.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
};

// Validate a plain password against an encrypted password.
const validatePassword = (encrypted, plainPassword) => {
    const decrypted = decryptPassword(encrypted);
    return decrypted === plainPassword;
};

// Generate an API key for a user using HMAC-SHA256.
const generateApiKey = (userId) => {
    return crypto
        .createHmac("sha256", `${CONFIG.APP_SECRET}`)
        .update(userId.toString())
        .digest("hex");
};

// Generate an auth token for a user using HMAC-MD5.
const generateToken = (userId) => {
    return crypto
        .createHmac("md5", `${CONFIG.APP_SECRET}`)
        .update(userId.toString())
        .digest("hex");
};

// Generate a random hex string (for reset tokens, etc.).
const generateRandomString = (bytes = 16) => {
    return crypto.randomBytes(bytes).toString("hex");
};

// Generate a strong password (1 uppercase, 1 lowercase, 1 digit, 1 special, 8+ chars).
const generateStrongPassword = (length = 8) => {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const special = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
    const all = upper + lower + digits + special;

    const regex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[^\w\s]).{8,}$/;

    let password = "";
    do {
        let chars = [
            upper[Math.floor(Math.random() * upper.length)],
            lower[Math.floor(Math.random() * lower.length)],
            digits[Math.floor(Math.random() * digits.length)],
            special[Math.floor(Math.random() * special.length)],
        ];
        for (let i = chars.length; i < length; i++) {
            chars.push(all[Math.floor(Math.random() * all.length)]);
        }
        // Shuffle
        for (let i = chars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        password = chars.join("");
    } while (!regex.test(password));
    return password;
};

export {
    encryptPassword,
    decryptPassword,
    validatePassword,
    generateApiKey,
    generateToken,
    generateRandomString,
    generateStrongPassword,
};
