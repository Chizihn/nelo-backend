#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🚀 Setting up Nelo Virtual Card Backend...\n");

// Check if .env exists
if (!fs.existsSync(".env")) {
  console.log("📝 Creating .env file from .env.example...");
  fs.copyFileSync(".env.example", ".env");
  console.log(
    "✅ .env file created. Please update it with your credentials.\n"
  );
} else {
  console.log("✅ .env file already exists.\n");
}

// Generate Prisma client
console.log("🔧 Generating Prisma client...");
try {
  execSync("npx prisma generate", { stdio: "inherit" });
  console.log("✅ Prisma client generated successfully.\n");
} catch (error) {
  console.error("❌ Failed to generate Prisma client:", error.message);
  process.exit(1);
}

// Create logs directory
const logsDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logsDir)) {
  console.log("📁 Creating logs directory...");
  fs.mkdirSync(logsDir, { recursive: true });
  console.log("✅ Logs directory created.\n");
}

console.log("🎉 Setup completed successfully!");
console.log("\nNext steps:");
console.log("1. Update your .env file with the correct credentials");
console.log("2. Set up your PostgreSQL database");
console.log("3. Run: npm run db:push");
console.log("4. Start development: npm run dev");
console.log("\nFor WhatsApp bot setup, see: WHATSAPP_BOT_SETUP.md");
