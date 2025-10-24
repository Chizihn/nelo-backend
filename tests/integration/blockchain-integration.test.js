/**
 * Blockchain Integration Tests
 * Tests all blockchain modifications and contract interactions
 */

require("dotenv").config();
const { ethers } = require("ethers");

// Test Configuration
const TEST_CONFIG = {
  // Test addresses (use your own test addresses)
  TEST_USER_ADDRESS: "0x742d35Cc6634C0532925a3b8D4C9db96590c6C8C",
  TEST_AMOUNT: "1", // 1 cNGN for testing

  // Contract addresses from environment
  CNGN_TOKEN_ADDRESS: process.env.CNGN_TOKEN_ADDRESS,
  NELO_CUSTODY_ADDRESS: process.env.NELO_CUSTODY_CONTRACT_ADDRESS,
  DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY,
  BASE_RPC_URL: process.env.BASE_RPC_URL,
};

// Validate environment
function validateEnvironment() {
  const required = [
    "CNGN_TOKEN_ADDRESS",
    "NELO_CUSTODY_ADDRESS",
    "DEPLOYER_PRIVATE_KEY",
    "BASE_RPC_URL",
  ];
  const missing = required.filter((key) => !TEST_CONFIG[key]);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  console.log("✅ Environment validation passed");
}

// Setup provider and contracts
function setupContracts() {
  const provider = new ethers.JsonRpcProvider(TEST_CONFIG.BASE_RPC_URL);
  const wallet = new ethers.Wallet(TEST_CONFIG.DEPLOYER_PRIVATE_KEY, provider);

  const cngnContract = new ethers.Contract(
    TEST_CONFIG.CNGN_TOKEN_ADDRESS,
    [
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address, uint256) returns (bool)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
    ],
    wallet
  );

  const neloContract = new ethers.Contract(
    TEST_CONFIG.NELO_CUSTODY_ADDRESS,
    [
      "function tokenWhitelisted(address) view returns (bool)",
      "function balanceOf(address, address) view returns (uint256)",
      "function deposit(address, uint256)",
    ],
    wallet
  );

  return { provider, wallet, cngnContract, neloContract };
}

// Test 1: Basic Contract Connectivity
async function testContractConnectivity() {
  console.log("\n🔗 Testing Contract Connectivity...");

  try {
    const { provider, cngnContract, neloContract } = setupContracts();

    // Test network connection
    const network = await provider.getNetwork();
    console.log(
      `✅ Connected to network: ${network.name} (${network.chainId})`
    );

    // Test cNGN contract
    const symbol = await cngnContract.symbol();
    const decimals = await cngnContract.decimals();
    console.log(`✅ cNGN Contract: ${symbol}, ${decimals} decimals`);

    // Test Nelo contract (basic call)
    const isWhitelisted = await neloContract.tokenWhitelisted(
      TEST_CONFIG.CNGN_TOKEN_ADDRESS
    );
    console.log(`✅ Nelo Contract: cNGN whitelisted = ${isWhitelisted}`);

    return { success: true, isWhitelisted };
  } catch (error) {
    console.error("❌ Contract connectivity failed:", error.message);
    return { success: false, error: error.message };
  }
}

// Test 2: Deployer Wallet Balance
async function testDeployerBalance() {
  console.log("\n💰 Testing Deployer Wallet Balance...");

  try {
    const { wallet, cngnContract } = setupContracts();

    // Check ETH balance for gas
    const ethBalance = await wallet.provider.getBalance(wallet.address);
    const ethFormatted = ethers.formatEther(ethBalance);
    console.log(`ETH Balance: ${ethFormatted} ETH`);

    if (parseFloat(ethFormatted) < 0.001) {
      console.warn("⚠️ Low ETH balance for gas fees");
    }

    // Check cNGN balance
    const cngnBalance = await cngnContract.balanceOf(wallet.address);
    const decimals = await cngnContract.decimals();
    const cngnFormatted = ethers.formatUnits(cngnBalance, decimals);
    console.log(`cNGN Balance: ${cngnFormatted} cNGN`);

    const hasEnoughCngn =
      parseFloat(cngnFormatted) >= parseFloat(TEST_CONFIG.TEST_AMOUNT);

    return {
      success: true,
      ethBalance: ethFormatted,
      cngnBalance: cngnFormatted,
      hasEnoughCngn,
      canTest: parseFloat(ethFormatted) > 0.001 && hasEnoughCngn,
    };
  } catch (error) {
    console.error("❌ Balance check failed:", error.message);
    return { success: false, error: error.message };
  }
}

// Test 3: cNGN Transfer (Simulating mintToUser)
async function testCngnTransfer() {
  console.log("\n📤 Testing cNGN Transfer (mintToUser simulation)...");

  try {
    const { cngnContract } = setupContracts();
    const decimals = await cngnContract.decimals();
    const amount = ethers.parseUnits(TEST_CONFIG.TEST_AMOUNT, decimals);

    // Check initial balance
    const initialBalance = await cngnContract.balanceOf(
      TEST_CONFIG.TEST_USER_ADDRESS
    );
    console.log(
      `Initial balance: ${ethers.formatUnits(initialBalance, decimals)} cNGN`
    );

    // Perform transfer
    console.log(
      `Transferring ${TEST_CONFIG.TEST_AMOUNT} cNGN to ${TEST_CONFIG.TEST_USER_ADDRESS}...`
    );
    const tx = await cngnContract.transfer(
      TEST_CONFIG.TEST_USER_ADDRESS,
      amount
    );
    console.log(`Transaction hash: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

    // Check final balance
    const finalBalance = await cngnContract.balanceOf(
      TEST_CONFIG.TEST_USER_ADDRESS
    );
    console.log(
      `Final balance: ${ethers.formatUnits(finalBalance, decimals)} cNGN`
    );

    const transferred = finalBalance - initialBalance;
    const transferredFormatted = ethers.formatUnits(transferred, decimals);

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      transferred: transferredFormatted,
      gasUsed: receipt.gasUsed.toString(),
    };
  } catch (error) {
    console.error("❌ cNGN transfer failed:", error.message);
    return { success: false, error: error.message };
  }
}

// Test 4: Nelo Custody Integration (if whitelisted)
async function testNeloCustody(isWhitelisted) {
  console.log("\n🏦 Testing Nelo Custody Integration...");

  if (!isWhitelisted) {
    console.log("⏭️ Skipping custody test - cNGN not whitelisted");
    return { success: true, skipped: true };
  }

  try {
    const { neloContract, cngnContract } = setupContracts();
    const decimals = await cngnContract.decimals();

    // Check custody balance
    const custodyBalance = await neloContract.balanceOf(
      TEST_CONFIG.TEST_USER_ADDRESS,
      TEST_CONFIG.CNGN_TOKEN_ADDRESS
    );
    console.log(
      `Custody balance: ${ethers.formatUnits(custodyBalance, decimals)} cNGN`
    );

    return {
      success: true,
      custodyBalance: ethers.formatUnits(custodyBalance, decimals),
    };
  } catch (error) {
    console.error("❌ Custody test failed:", error.message);
    return { success: false, error: error.message };
  }
}

// Test 5: Application Service Integration
async function testApplicationServices() {
  console.log("\n🔧 Testing Application Services...");

  try {
    // Import our services (adjust paths as needed)
    const {
      CngnService,
    } = require("../../src/services/blockchain/cngnService");
    const {
      NeloContractService,
    } = require("../../src/services/blockchain/neloContractService");

    // Test balance reading
    const balance = await CngnService.getBalance(TEST_CONFIG.TEST_USER_ADDRESS);
    console.log(`✅ CngnService.getBalance(): ${balance.balance} cNGN`);

    // Test whitelisting check
    const isWhitelisted = await NeloContractService.isTokenWhitelisted(
      TEST_CONFIG.CNGN_TOKEN_ADDRESS
    );
    console.log(
      `✅ NeloContractService.isTokenWhitelisted(): ${isWhitelisted}`
    );

    return {
      success: true,
      balance: balance.balance,
      isWhitelisted,
    };
  } catch (error) {
    console.error("❌ Application service test failed:", error.message);
    return { success: false, error: error.message };
  }
}

// Main Test Runner
async function runAllTests() {
  console.log("🧪 Starting Blockchain Integration Tests\n");
  console.log("=".repeat(50));

  try {
    // Validate environment
    validateEnvironment();

    // Run tests
    const connectivityResult = await testContractConnectivity();
    if (!connectivityResult.success) {
      throw new Error("Contract connectivity failed");
    }

    const balanceResult = await testDeployerBalance();
    if (!balanceResult.success) {
      throw new Error("Balance check failed");
    }

    if (!balanceResult.canTest) {
      console.log("\n⚠️ Insufficient funds for transfer tests");
      console.log("Please fund the deployer wallet with ETH and cNGN");
      return;
    }

    const transferResult = await testCngnTransfer();
    const custodyResult = await testNeloCustody(
      connectivityResult.isWhitelisted
    );
    const serviceResult = await testApplicationServices();

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(50));

    console.log(
      `✅ Contract Connectivity: ${
        connectivityResult.success ? "PASS" : "FAIL"
      }`
    );
    console.log(
      `✅ Deployer Balance: ${balanceResult.success ? "PASS" : "FAIL"}`
    );
    console.log(
      `✅ cNGN Transfer: ${transferResult.success ? "PASS" : "FAIL"}`
    );
    console.log(
      `✅ Nelo Custody: ${
        custodyResult.success
          ? custodyResult.skipped
            ? "SKIPPED"
            : "PASS"
          : "FAIL"
      }`
    );
    console.log(
      `✅ Application Services: ${serviceResult.success ? "PASS" : "FAIL"}`
    );

    if (transferResult.success) {
      console.log(
        `\n🎉 Successfully transferred ${transferResult.transferred} cNGN`
      );
      console.log(`📋 Transaction: ${transferResult.txHash}`);
      console.log(`⛽ Gas used: ${transferResult.gasUsed}`);
    }

    console.log(
      `\n🔐 cNGN Whitelisted: ${
        connectivityResult.isWhitelisted
          ? "YES (Custody available)"
          : "NO (Wallet only)"
      }`
    );
  } catch (error) {
    console.error("\n💥 Test suite failed:", error.message);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testContractConnectivity,
  testDeployerBalance,
  testCngnTransfer,
  testNeloCustody,
  testApplicationServices,
};
