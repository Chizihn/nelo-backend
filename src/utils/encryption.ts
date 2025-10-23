import crypto from "crypto";
import { env } from "@/config/env";

const ALGORITHM = "aes-256-cbc";
// Ensure key is exactly 32 bytes for AES-256
const KEY = crypto.scryptSync(env.ENCRYPTION_KEY, "salt", 32);

export class EncryptionService {
  static encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    return `${iv.toString("hex")}:${encrypted}`;
  }

  static decrypt(encryptedData: string): string {
    const [ivHex, encrypted] = encryptedData.split(":");

    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  static hash(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
  }

  static generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }
}
