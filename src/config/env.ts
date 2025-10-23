import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().transform(Number).default("3000"),

  // Database
  DATABASE_URL: z.string(),

  // Blockchain
  BASE_RPC_URL: z.string().url(),
  BASE_CHAIN_ID: z.string().transform(Number).default("84532"),
  NELO_CUSTODY_CONTRACT_ADDRESS: z.string().optional(),
  CNGN_TOKEN_ADDRESS: z.string().optional(),
  L2_RESOLVER_ADDRESS: z.string().optional(),
  DEPLOYER_PRIVATE_KEY: z.string().optional(),
  FEE_COLLECTOR_ADDRESS: z.string().optional(),

  // WhatsApp
  WHATSAPP_ACCESS_TOKEN: z.string(),
  WHATSAPP_PHONE_NUMBER_ID: z.string(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string(),
  WHATSAPP_APP_SECRET: z.string(),

  // On/Off Ramp
  ONRAMP_PROVIDER: z.string().default("moonpay"),
  ONRAMP_API_KEY: z.string().optional(),
  OFFRAMP_PROVIDER: z.string().default("moonpay"),
  OFFRAMP_API_KEY: z.string().optional(),

  // Removed Sudo Africa references - using mock cards only

  // Security
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(32),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),

  // Base URL for callbacks and webhooks
  BASE_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
