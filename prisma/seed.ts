import { PrismaClient } from "@prisma/client";
import { logger } from "../src/utils/logger";

const prisma = new PrismaClient();

async function main() {
  logger.info("Starting database seed...");

  // Add any seed data here if needed
  // For example, creating test users or initial data

  logger.info("Database seed completed successfully");
}

main()
  .catch((e) => {
    logger.error("Error during database seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
