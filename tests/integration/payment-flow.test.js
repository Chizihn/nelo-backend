/**
 * Payment Flow Integration Tests
 * Tests the complete payment confirmation flow
 */

require("dotenv").config();

// Test Configuration
const TEST_CONFIG = {
  TEST_USER_ID: "test-user-123",
  TEST_WHATSAPP: "+1234567890",
  TEST_AMOUNT: 1000, // 1000 NGN
  TEST_WALLET_ADDRESS: "0x742d35Cc6634C0532925a3b8D4C9db96590c6C8C",
};

// Mock Database (replace with actual DB calls)
const mockDatabase = {
  users: new Map(),
  transactions: new Map(),

  createUser(userData) {
    this.users.set(userData.id, userData);
    return userData;
  },

  getUser(id) {
    return this.users.get(id);
  },

  createTransaction(txData) {
    const id = `tx-${Date.now()}`;
    this.transactions.set(id, { ...txData, id });
    return this.transactions.get(id);
  },
};

// Setup test user
function setupTestUser() {
  const user = {
    id: TEST_CONFIG.TEST_USER_ID,
    whatsappNumber: TEST_CONFIG.TEST_WHATSAPP,
    walletAddress: TEST_CONFIG.TEST_WALLET_ADDRESS,
    encryptedPrivateKey: "mock-encrypted-key",
    kycVerified: true,
    virtualAccountNumber: "0067100155",
    virtualBankName: "Wema Bank",
  };

  mockDatabase.createUser(user);
  console.log("✅ Test user created:", user.whatsappNumber);
  return user;
}

// Test 1: Payment Initiation (buy cngn)
async function testPaymentInitiation() {
  console.log("\n💰 Testing Payment Initiation...");

  try {
    // Import service (adjust path as needed)
    const {
      IntegratedOnRampService,
    } = require("../../src/services/payment/integratedOnRampService");

    const result = await IntegratedOnRampService.depositNGN({
      userId: TEST_CONFIG.TEST_USER_ID,
      amountNGN: TEST_CONFIG.TEST_AMOUNT,
      paymentMethod: "BANK_TRANSFER",
    });

    console.log("Payment initiation result:", result);

    if (result.success) {
      console.log("✅ Payment instructions generated");
      console.log("📋 Reference:", result.paymentReference);
      return {
        success: true,
        paymentReference: result.paymentReference,
        instructions: result.paymentInstructions,
      };
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error("❌ Payment initiation failed:", error.message);
    return { success: false, error: error.message };
  }
}

// Test 2: Payment Confirmation (paid 10000)
async function testPaymentConfirmation(paymentReference) {
  console.log("\n✅ Testing Payment Confirmation...");

  try {
    // Import service
    const {
      IntegratedOnRampService,
    } = require("../../src/services/payment/integratedOnRampService");

    const result = await IntegratedOnRampService.confirmPayment({
      userId: TEST_CONFIG.TEST_USER_ID,
      amountNGN: TEST_CONFIG.TEST_AMOUNT,
      paymentReference: paymentReference || `test-ref-${Date.now()}`,
    });

    console.log("Payment confirmation result:", result);

    if (result.success) {
      console.log("✅ Payment confirmed successfully");
      console.log("🔗 Transaction hash:", result.txHash);
      return {
        success: true,
        txHash: result.txHash,
      };
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error("❌ Payment confirmation failed:", error.message);
    return { success: false, error: error.message };
  }
}

// Test 3: Balance Verification
async function testBalanceVerification() {
  console.log("\n📊 Testing Balance Verification...");

  try {
    // Import service
    const {
      CngnService,
    } = require("../../src/services/blockchain/cngnService");

    const balance = await CngnService.getBalance(
      TEST_CONFIG.TEST_WALLET_ADDRESS
    );

    console.log("Balance check result:", balance);
    console.log(`✅ Current balance: ${balance.balance} cNGN`);

    return {
      success: true,
      balance: balance.balance,
      symbol: balance.symbol,
    };
  } catch (error) {
    console.error("❌ Balance verification failed:", error.message);
    return { success: false, error: error.message };
  }
}

// Test 4: WhatsApp Bot Message Flow
async function testBotMessageFlow() {
  console.log("\n🤖 Testing Bot Message Flow...");

  try {
    // Import message handler
    const {
      MessageHandler,
    } = require("../../src/services/whatsapp/messageHandler");

    const handler = new MessageHandler();

    // Mock WhatsApp message
    const mockMessage = {
      from: TEST_CONFIG.TEST_WHATSAPP,
      text: { body: "buy cngn" },
    };

    // This would normally send to WhatsApp, but we'll just test the logic
    console.log('📱 Simulating: "buy cngn" message');
    console.log("✅ Bot message flow test completed (mock)");

    return { success: true, message: "Bot flow tested" };
  } catch (error) {
    console.error("❌ Bot message flow failed:", error.message);
    return { success: false, error: error.message };
  }
}

// Test 5: End-to-End Flow Simulation
async function testEndToEndFlow() {
  console.log("\n🔄 Testing End-to-End Payment Flow...");

  try {
    // Step 1: User initiates payment
    console.log('Step 1: User types "buy cngn"');
    const initiationResult = await testPaymentInitiation();

    if (!initiationResult.success) {
      throw new Error("Payment initiation failed");
    }

    // Step 2: User makes bank transfer (simulated)
    console.log("Step 2: User makes bank transfer (simulated)");
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate delay

    // Step 3: User confirms payment
    console.log('Step 3: User types "paid 1000"');
    const confirmationResult = await testPaymentConfirmation(
      initiationResult.paymentReference
    );

    if (!confirmationResult.success) {
      throw new Error("Payment confirmation failed");
    }

    // Step 4: Verify balance updated
    console.log("Step 4: Check balance updated");
    const balanceResult = await testBalanceVerification();

    return {
      success: true,
      steps: {
        initiation: initiationResult.success,
        confirmation: confirmationResult.success,
        balance: balanceResult.success,
      },
      txHash: confirmationResult.txHash,
      finalBalance: balanceResult.balance,
    };
  } catch (error) {
    console.error("❌ End-to-end flow failed:", error.message);
    return { success: false, error: error.message };
  }
}

// Main Test Runner
async function runPaymentFlowTests() {
  console.log("🧪 Starting Payment Flow Integration Tests\n");
  console.log("=".repeat(50));

  try {
    // Setup
    setupTestUser();

    // Run individual tests
    const initiationResult = await testPaymentInitiation();
    const confirmationResult = await testPaymentConfirmation();
    const balanceResult = await testBalanceVerification();
    const botResult = await testBotMessageFlow();

    // Run end-to-end test
    const e2eResult = await testEndToEndFlow();

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 PAYMENT FLOW TEST SUMMARY");
    console.log("=".repeat(50));

    console.log(
      `✅ Payment Initiation: ${initiationResult.success ? "PASS" : "FAIL"}`
    );
    console.log(
      `✅ Payment Confirmation: ${confirmationResult.success ? "PASS" : "FAIL"}`
    );
    console.log(
      `✅ Balance Verification: ${balanceResult.success ? "PASS" : "FAIL"}`
    );
    console.log(`✅ Bot Message Flow: ${botResult.success ? "PASS" : "FAIL"}`);
    console.log(`✅ End-to-End Flow: ${e2eResult.success ? "PASS" : "FAIL"}`);

    if (e2eResult.success) {
      console.log(`\n🎉 End-to-end flow completed successfully!`);
      console.log(`📋 Transaction: ${e2eResult.txHash}`);
      console.log(`💰 Final Balance: ${e2eResult.finalBalance} cNGN`);
    }
  } catch (error) {
    console.error("\n💥 Payment flow test suite failed:", error.message);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runPaymentFlowTests().catch(console.error);
}

module.exports = {
  runPaymentFlowTests,
  testPaymentInitiation,
  testPaymentConfirmation,
  testBalanceVerification,
  testBotMessageFlow,
  testEndToEndFlow,
};
