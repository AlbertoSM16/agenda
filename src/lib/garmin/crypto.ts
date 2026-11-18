import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function garminConfigured() {
  return !!process.env.GARMIN_TOKEN_KEY;
}

function key() {
  const k = process.env.GARMIN_TOKEN_KEY;
  if (!k) throw new Error("Falta la variable de entorno GARMIN_TOKEN_KEY (ver README).");
  const b = Buffer.from(k, "base64");
  if (b.length !== 32) throw new Error("GARMIN_TOKEN_KEY debe ser una clave de 32 bytes en base64 (openssl rand -base64 32).");
  return b;
}

/** AES-256-GCM → base64(iv | tag | datos). */
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString("base64");
}

export function decrypt(enc: string) {
  const b = Buffer.from(enc, "base64");
  const d = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}
