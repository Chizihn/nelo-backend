#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🚀 Deploying Nelo Smart Contract to Base Sepolia...\n");

// Check if Nelo-sc directory exists
const neloDir = path.join(__dirname, "..", "Nelo-sc");
if (!fs.existsSync(neloDir)) {
  console.error("❌ Nelo-sc directory not found!");
  console.log('Please ensure the smart contract repo is cloned as "Nelo-sc"');
  process.exit(1);
}

// Check if .env exists in Nelo-sc
const neloEnvPath = path.join(neloDir, ".env");
if (!fs.existsSync(neloEnvPath)) {
  console.log("📝 Creating .env file in Nelo-sc...");
  const envExample = path.join(neloDir, ".env.example");
  if (fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, neloEnvPath);
    console.log("✅ .env file created from .env.example");
    console.log("⚠️  Please update Nelo-sc/.env with your values:");
    console.log("   - BASE_SEPOLIA_URL");
    console.log("   - PRIVATE_KEY");
    console.log("   - ADMIN_ADDRESS");
    console.log(
      "   - WRAPPED_NATIVE_ADDRESS (use 0x0000000000000000000000000000000000000000)"
    );
    console.log("\nThen run this script again.\n");
    process.exit(0);
  }
}

try {
  // Change to Nelo-sc directory
  process.chdir(neloDir);

  // Install dependencies
  console.log("📦 Installing dependencies...");
  execSync("npm install", { stdio: "inherit" });

  // Deploy contract
  console.log("🔧 Deploying Nelo contract...");
  const deployOutput = execSync(
    "npx hardhat ignition deploy ./ignition/modules/deploy.ts --network baseSepolia",
    {
      encoding: "utf8",
      stdio: "pipe",
    }
  );

  console.log(deployOutput);

  // Extract contract address from output
  const addressMatch = deployOutput.match(/Nelo#Nelo - (0x[a-fA-F0-9]{40})/);
  if (addressMatch) {
    const contractAddress = addressMatch[1];
    console.log(`\n✅ Nelo contract deployed successfully!`);
    console.log(`📍 Contract Address: ${contractAddress}`);

    // Update backend .env file
    const backendEnvPath = path.join(__dirname, "..", ".env");
    if (fs.existsSync(backendEnvPath)) {
      let envContent = fs.readFileSync(backendEnvPath, "utf8");

      if (envContent.includes("NELO_CUSTODY_CONTRACT_ADDRESS=")) {
        envContent = envContent.replace(
          /NELO_CUSTODY_CONTRACT_ADDRESS=.*/,
          `NELO_CUSTODY_CONTRACT_ADDRESS=${contractAddress}`
        );
      } else {
        envContent += `\nNELO_CUSTODY_CONTRACT_ADDRESS=${contractAddress}\n`;
      }

      fs.writeFileSync(backendEnvPath, envContent);
      console.log("✅ Updated backend .env with contract address");
    }

    console.log("\n🎯 Next Steps:");
    console.log("1. Get cNGN contract address for Base Sepolia");
    console.log("2. Whitelist cNGN token in Nelo contract");
    console.log("3. Test deposit/withdraw flows");
    console.log("4. Start your backend: npm run dev");
  } else {
    console.log(
      "⚠️  Could not extract contract address from deployment output"
    );
    console.log(
      "Please manually update NELO_CUSTODY_CONTRACT_ADDRESS in your .env file"
    );
  }
} catch (error) {
  console.error("❌ Deployment failed:", error.message);
  console.log("\n🔧 Troubleshooting:");
  console.log("1. Check your BASE_SEPOLIA_URL is correct");
  console.log("2. Ensure your PRIVATE_KEY has Base Sepolia ETH");
  console.log("3. Verify your ADMIN_ADDRESS is correct");
  console.log("4. Make sure you have internet connection");
  process.exit(1);
}
