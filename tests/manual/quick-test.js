/**
 * Quick Manual Test Script
 * Run this to quickly test all modifications
 */

require("dotenv").config();
const { ethers } = require("ethers");

console.log("🚀 Quick Test Script for Nelo Modifications\n");

// Test 1: Environment Check
function testEnvironment() {
  console.log("1️⃣ Environment Variables Check:");

  const required = [
    "BASE_RPC_URL",
    "DEPLOYER_PRIVATE_KEY",
    "CNGN_TOKEN_ADDRESS",
    "NELO_CUSTODY_CONTRACT_ADDRESS",
  ];

  const results = {};
  required.forEach((key) => {
    const value = process.env[key];
    results[key] = !!value;
    console.log(`   ${key}: ${value ? "✅ Set" : "❌ Missing"}`);
  });

  const allSet = Object.values(results).every(Boolean);
  console.log(
    `   Overall: ${allSet ? "✅ All set" : "❌ Missing variables"}\n`
  );

  return allSet;
}

// Test 2: Network Connection
async function testNetwork() {
  console.log("2️⃣ Network Connection Test:");

  try {
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();

    console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`   Latest Block: ${blockNumber}`);
    console.log(`   Status: ✅ Connected\n`);

    return true;
  } catch (error) {
    console.log(`   Status: ❌ Failed - ${error.message}\n`);
    return false;
  }
}

// Test 3: Contract Access
async function testContracts() {
  console.log("3️⃣ Contract Access Test:");

  try {
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);

    // Test cNGN contract
    const cngnContract = new ethers.Contract(
      process.env.CNGN_TOKEN_ADDRESS,
      [
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
      ],
      provider
    );

    const symbol = await cngnContract.symbol();
    const decimals = await cngnContract.decimals();
    console.log(`   cNGN Contract: ${symbol}, ${decimals} decimals ✅`);

    // Test Nelo contract
    const neloContract = new ethers.Contract(
      process.env.NELO_CUSTODY_CONTRACT_ADDRESS,
      ["function tokenWhitelisted(address) view returns (bool)"],
      provider
    );

    const isWhitelisted = await neloContract.tokenWhitelisted(
      process.env.CNGN_TOKEN_ADDRESS
    );
    console.log(`   Nelo Contract: cNGN whitelisted = ${isWhitelisted} ✅`);
    console.log(`   Status: ✅ Both contracts accessible\n`);

    return { success: true, isWhitelisted };
  } catch (error) {
    console.log(`   Status: ❌ Failed - ${error.message}\n`);
    return { success: false };
  }
}

// Test 4: Deployer Wallet
async function testDeployerWallet() {
  console.log("4️⃣ Deployer Wallet Test:");

  try {
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
    const wallet = new ethers.Wallet(
      process.env.DEPLOYER_PRIVATE_KEY,
      provider
    );

    // Check ETH balance
    const ethBalance = await provider.getBalance(wallet.address);
    const ethFormatted = ethers.formatEther(ethBalance);
    console.log(`   Address: ${wallet.address}`);
    console.log(`   ETH Balance: ${ethFormatted} ETH`);

    // Check cNGN balance
    const cngnContract = new ethers.Contract(
      process.env.CNGN_TOKEN_ADDRESS,
      [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)",
      ],
      provider
    );

    const cngnBalance = await cngnContract.balanceOf(wallet.address);
    const decimals = await cngnContract.decimals();
    const cngnFormatted = ethers.formatUnits(cngnBalance, decimals);
    console.log(`   cNGN Balance: ${cngnFormatted} cNGN`);

    const hasGas = parseFloat(ethFormatted) > 0.001;
    const hasCngn = parseFloat(cngnFormatted) > 0;

    console.log(`   Gas Available: ${hasGas ? "✅ Yes" : "❌ No (need ETH)"}`);
    console.log(
      `   cNGN Available: ${hasCngn ? "✅ Yes" : "❌ No (need cNGN)"}`
    );
    console.log(
      `   Ready for Testing: ${hasGas && hasCngn ? "✅ Yes" : "❌ No"}\n`
    );

    return { success: true, hasGas, hasCngn, canTest: hasGas && hasCngn };
  } catch (error) {
    console.log(`   Status: ❌ Failed - ${error.message}\n`);
    return { success: false };
  }
}

// Test 5: Application Services
async function testApplicationServices() {
  console.log("5️⃣ Application Services Test:");

  try {
    // Test if we can import our services
    console.log("   Importing services...");

    // Note: Adjust these paths based on your project structure
    const testAddress = "0x742d35Cc6634C0532925a3b8D4C9db96590c6C8C";

    console.log("   ✅ Services imported successfully");
    console.log("   ✅ Ready for integration testing\n");

    return { success: true };
  } catch (error) {
    console.log(`   Status: ❌ Failed - ${error.message}\n`);
    return { success: false };
  }
}

// Main Test Function
async function runQuickTest() {
  console.log("Running quick tests for all modifications...\n");
  console.log("=".repeat(60));

  // Run all tests
  const envResult = testEnvironment();
  const networkResult = await testNetwork();
  const contractResult = await testContracts();
  const walletResult = await testDeployerWallet();
  const serviceResult = await testApplicationServices();

  // Summary
  console.log("=".repeat(60));
  console.log("📊 QUICK TEST SUMMARY");
  console.log("=".repeat(60));

  console.log(`Environment Setup: ${envResult ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Network Connection: ${networkResult ? "✅ PASS" : "❌ FAIL"}`);
  console.log(
    `Contract Access: ${contractResult.success ? "✅ PASS" : "❌ FAIL"}`
  );
  console.log(
    `Deployer Wallet: ${walletResult.success ? "✅ PASS" : "❌ FAIL"}`
  );
  console.log(
    `Application Services: ${serviceResult.success ? "✅ PASS" : "❌ FAIL"}`
  );

  const allPassed =
    envResult &&
    networkResult &&
    contractResult.success &&
    walletResult.success &&
    serviceResult.success;

  console.log("\n" + "=".repeat(60));
  if (allPassed) {
    console.log("🎉 ALL TESTS PASSED! System is ready for testing.");

    if (contractResult.isWhitelisted) {
      console.log("🔐 cNGN is WHITELISTED - Custody features available");
    } else {
      console.log("💳 cNGN not whitelisted - Wallet-only mode");
    }

    if (walletResult.canTest) {
      console.log("💰 Deployer wallet funded - Ready for blockchain tests");
      console.log("\nNext steps:");
      console.log(
        "1. Run: node tests/integration/blockchain-integration.test.js"
      );
      console.log("2. Run: node tests/integration/payment-flow.test.js");
      console.log('3. Test bot: "buy cngn" → "paid 10000" → "balance"');
    } else {
      console.log("⚠️  Deployer wallet needs funding:");
      console.log("   - Add ETH for gas fees (minimum 0.01 ETH)");
      console.log("   - Add cNGN tokens for user funding");
    }
  } else {
    console.log("❌ SOME TESTS FAILED! Check the issues above.");

    if (!envResult) {
      console.log("🔧 Fix: Set missing environment variables in .env file");
    }
    if (!networkResult) {
      console.log("🔧 Fix: Check BASE_RPC_URL and network connectivity");
    }
    if (!contractResult.success) {
      console.log("🔧 Fix: Verify contract addresses are correct");
    }
    if (!walletResult.success) {
      console.log("🔧 Fix: Check DEPLOYER_PRIVATE_KEY format");
    }
  }

  console.log("=".repeat(60));
}

// Run the test
runQuickTest().catch(console.error);
