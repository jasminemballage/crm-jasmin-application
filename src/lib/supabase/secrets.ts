import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { DomainError } from "../domain";

function encryptionKey(value = process.env.CRM_SETTINGS_ENCRYPTION_KEY) {
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new DomainError("La clé de chiffrement des réglages est absente ou invalide.", 503);
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new DomainError("La clé de chiffrement des réglages est invalide.", 503);
  return key;
}
export function encryptSettings(provider: string, value: unknown, key?: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(key), nonce);
  cipher.setAAD(Buffer.from(`jasmin:settings:v1:${provider}`));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(".");
}
export function decryptSettings(provider: string, value: string, key?: string): unknown {
  try {
    const [version, nonce, tag, ciphertext, extra] = value.split(".");
    if (version !== "v1" || !nonce || !tag || !ciphertext || extra) throw new Error("format");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(key), Buffer.from(nonce, "base64"));
    decipher.setAAD(Buffer.from(`jasmin:settings:v1:${provider}`));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8"));
  } catch { throw new DomainError("Impossible de déchiffrer les réglages partagés. Vérifiez la clé de chiffrement du serveur.", 503); }
}
