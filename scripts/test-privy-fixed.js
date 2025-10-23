const { PrivyClient } = require("@privy-io/node");
require("dotenv").config();

async function testPrivyFixed() {
  try {
    console.log("Testing fixed Privy implementation...");

    const privy = new PrivyClient({
      appId: process.env.PRIVY_APP_ID,
      appSecret: process.env.PRIVY_APP_SECRET,
    });

    // Test creating user with wallet (like our service does)
    console.log("\nTest: Creating user with wallet...");
    const testPhoneNumber = `+234${Date.now().toString().slice(-10)}`;
    const userWithWallet = await privy.users().create({
      linked_accounts: [
        { type: "custom_auth", custom_user_id: testPhoneNumber },
      ],
      wallets: [{ chain_type: "ethereum" }],
    });

    console.log("User created:", JSON.stringify(userWithWallet, null, 2));

    // Extract wallet address like our service does
    const walletAccount = userWithWallet.linked_accounts?.find(
      (account) =>
        account.type === "wallet" && account.chain_type === "ethereum"
    );

    const walletAddress = walletAccount?.address;

    console.log("\n✅ Wallet extraction test:");
    console.log("Wallet account found:", !!walletAccount);
    console.log("Wallet address:", walletAddress);

    if (walletAddress) {
      console.log("✅ SUCCESS: Wallet address extracted successfully!");
    } else {
      console.log("❌ FAILED: No wallet address found");

      // Check wallets field as fallback
      const wallet = userWithWallet.wallets?.[0];
      if (wallet?.address) {
        console.log(
          "✅ FALLBACK: Found wallet in wallets field:",
          wallet.address
        );
      } else {
        console.log("❌ FALLBACK FAILED: No wallet in wallets field either");
      }
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testPrivyFixed();
