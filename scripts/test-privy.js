const { PrivyClient } = require("@privy-io/node");
require("dotenv").config();

async function testPrivyConnection() {
  try {
    console.log("Testing Privy connection...");

    if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
      throw new Error("Privy configuration missing");
    }

    console.log(`App ID: ${process.env.PRIVY_APP_ID}`);
    console.log(
      `App Secret: ${process.env.PRIVY_APP_SECRET ? "Set" : "Not set"}`
    );

    const privy = new PrivyClient({
      appId: process.env.PRIVY_APP_ID,
      appSecret: process.env.PRIVY_APP_SECRET,
    });

    // Test 1: Create a simple wallet
    console.log("\nTest 1: Creating a wallet...");
    const wallet = await privy.wallets().create({
      chain_type: "ethereum",
    });
    console.log("Wallet created:", wallet);

    // Test 2: Create a user
    console.log("\nTest 2: Creating a user...");
    const testPhoneNumber = `+234${Date.now().toString().slice(-10)}`;
    const user = await privy.users().create({
      linked_accounts: [
        { type: "custom_auth", custom_user_id: testPhoneNumber },
      ],
    });
    console.log("User created:", user);

    // Test 3: Create user with wallet
    console.log("\nTest 3: Creating user with wallet...");
    const testPhoneNumber2 = `+234${Date.now().toString().slice(-10)}`;
    const userWithWallet = await privy.users().create({
      linked_accounts: [
        { type: "custom_auth", custom_user_id: testPhoneNumber2 },
      ],
      wallets: [{ chain_type: "ethereum" }],
    });
    console.log(
      "User with wallet created:",
      JSON.stringify(userWithWallet, null, 2)
    );

    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    if (error.status) {
      console.error("Status:", error.status);
    }
    if (error.name) {
      console.error("Error name:", error.name);
    }
  }
}

testPrivyConnection();
