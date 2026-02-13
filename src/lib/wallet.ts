import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function isWalletConfigured(): boolean {
  const key = process.env.WALLET_ENCRYPTION_KEY;
  return !!key && key.length === 64;
}

function getEncryptionKey(): Buffer {
  const key = process.env.WALLET_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('WALLET_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

export function encryptPrivateKey(privateKey: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptPrivateKey(encrypted: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, ciphertext] = encrypted.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function generateAgentWallet(): { address: string; encryptedPrivateKey: string } {
  const privateKey = generatePrivateKey();
  const address = privateKeyToAddress(privateKey);
  const encryptedPrivateKey = encryptPrivateKey(privateKey);
  return { address, encryptedPrivateKey };
}

export function buildWalletLinkMessage(walletAddress: string, agentId: string): string {
  return `Link wallet ${walletAddress.toLowerCase()} to AgentGram agent ${agentId}`;
}
