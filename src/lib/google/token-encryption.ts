// ============================================================================
// Token Encryption Utilities
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// AES-256-GCM encryption for OAuth tokens stored in the database.
// Uses NEXTAUTH_SECRET as the encryption key (same as session encryption).
// ============================================================================

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derive a 32-byte encryption key from NEXTAUTH_SECRET.
 * Uses scrypt for key derivation with a fixed salt derived from the app name.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET ?? 'dev-secret-change-me-in-production';
  const salt = 'seocoach-token-encryption-v1';

  return scryptSync(secret, salt, KEY_LENGTH);
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string containing IV + auth tag + ciphertext.
 *
 * @param plaintext - The string to encrypt (e.g., an OAuth token)
 * @returns Base64-encoded encrypted string
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine: IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64'),
  ]);

  return combined.toString('base64');
}

/**
 * Decrypt a base64-encoded AES-256-GCM encrypted string.
 *
 * @param encryptedBase64 - The encrypted string to decrypt
 * @returns The original plaintext string
 */
export function decrypt(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, 'base64');

  // Extract: IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
