import crypto from "crypto";
import { env } from "@/config/env";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(env.ENCRYPTION_KEY, "utf8");

export class EncryptionService {
  static encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, KEY);
    cipher.setAAD(Buffer.from("virtual-card", "utf8"));

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  static decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(":");

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipher(ALGORITHM, KEY);
    decipher.setAAD(Buffer.from("virtual-card", "utf8"));
    decipher.setAuthTag(authTag);

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
