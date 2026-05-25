/**
 * Quick smoke test — run with:
 *   node lib/crypto/verify-encryption.mjs
 *
 * Generates a temporary ENCRYPTION_KEY, exercises encrypt/decrypt,
 * and checks edge cases.
 */
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

// Generate a one-time key for testing
const KEY = randomBytes(32);

function encrypt(plaintext) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(ciphertext) {
  const [ivHex, tagHex, encHex] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  OK  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

console.log("--- Encryption verification ---\n");

// 1. Round-trip
const secret = "vK9x2mPqR8sT4wN7";
const encrypted = encrypt(secret);
const decrypted = decrypt(encrypted);
assert("Round-trip: decrypt(encrypt(x)) === x", decrypted === secret);

// 2. Format: 3 hex parts separated by ':'
const parts = encrypted.split(":");
assert("Format: 3 parts separated by ':'", parts.length === 3);
assert("IV is 24 hex chars (12 bytes)", parts[0].length === 24);
assert("Tag is 32 hex chars (16 bytes)", parts[1].length === 32);

// 3. Different IVs each call
const e1 = encrypt(secret);
const e2 = encrypt(secret);
assert("Two encryptions of same text produce different ciphertexts", e1 !== e2);
assert("Both decrypt back to original", decrypt(e1) === secret && decrypt(e2) === secret);

// 4. Empty string
assert("Empty string round-trip", decrypt(encrypt("")) === "");

// 5. Unicode
const unicode = "clef-api-éàü-🚀";
assert("Unicode round-trip", decrypt(encrypt(unicode)) === unicode);

// 6. Tamper detection
let tamperOk = false;
try {
  const tampered = encrypted.slice(0, -2) + "ff";
  decrypt(tampered);
} catch {
  tamperOk = true;
}
assert("Tampered ciphertext throws", tamperOk);

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
process.exit(failed > 0 ? 1 : 0);
