const { PrivyService } = require("../dist/services/wallet/privyService");
require("dotenv").config();

async function testCompleteFlow() {
  try {
    console.log("Testing complete user creation flow...");

    // Build the project first
    console.log("Building project...");
    const { execSync } = require("child_process");
    execSync("npm run build", { stdio: "inherit" });

    const privyService = new PrivyService();

    // Test creating user with wallet (like our service does)
    const testPhoneNumber = `+234${Date.now().toString().slice(-10)}`;
    console.log(`\nTesting with phone number: ${testPhoneNumber}`);

    const result = await privyService.createUserWithWallet(testPhoneNumber);

    console.log("\nResult:", JSON.stringify(result, null, 2));

    if (result.success && result.user?.wallet?.address) {
      console.log("✅ SUCCESS: Complete flow works!");
      console.log(`User ID: ${result.user.id}`);
      console.log(`Wallet Address: ${result.user.wallet.address}`);
    } else {
      console.log("❌ FAILED: Flow did not complete successfully");
      console.log("Error:", result.error);
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testCompleteFlow();
