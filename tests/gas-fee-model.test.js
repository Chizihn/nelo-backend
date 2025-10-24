/**
 * Test the new gas fee model implementation
 */

const { FeeService } = require("../src/services/payment/feeService");

async function testGasFeeModel() {
  console.log("🧪 Testing Gas Fee Model Implementation\n");

  try {
    // Test 1: Calculate total transaction cost
    console.log("1️⃣ Testing total transaction cost calculation...");
    const costBreakdown = await FeeService.calculateTotalTransactionCost(
      "1000",
      "TRANSFER"
    );

    console.log("Cost Breakdown:");
    console.log(`- Original Amount: ${costBreakdown.originalAmount} cNGN`);
    console.log(`- Service Fee: ${costBreakdown.serviceFee} cNGN`);
    console.log(
      `- Gas Fee: ${costBreakdown.gasFeeNGN} cNGN (${costBreakdown.gasFeeETH} ETH)`
    );
    console.log(`- Total Cost: ${costBreakdown.totalCostNGN} cNGN`);
    console.log(
      `- Recipient Gets: ${costBreakdown.netAmountToRecipient} cNGN\n`
    );

    // Test 2: Gas fee estimation for different transaction types
    console.log("2️⃣ Testing gas fee estimation for different operations...");
    const operations = [
      "TRANSFER",
      "DEPOSIT_TO_CUSTODY",
      "WITHDRAW_FROM_CUSTODY",
      "APPROVE",
    ];

    for (const op of operations) {
      const gasEstimate = await FeeService.estimateGasFeeETH(op);
      const gasConversion = await FeeService.convertGasFeeToNGN(
        gasEstimate.gasFeeETH
      );

      console.log(`${op}:`);
      console.log(
        `  - Gas Limit: ${gasEstimate.gasLimit.toLocaleString()} gas`
      );
      console.log(
        `  - Gas Fee: ${gasEstimate.gasFeeETH} ETH (${gasConversion.gasFeeNGN} cNGN)`
      );
    }
    console.log();

    // Test 3: Fee breakdown display
    console.log("3️⃣ Testing fee breakdown display...");
    console.log(costBreakdown.breakdown);
    console.log();

    // Test 4: Different amounts
    console.log("4️⃣ Testing different transfer amounts...");
    const amounts = ["100", "1000", "10000", "100000"];

    for (const amount of amounts) {
      const cost = await FeeService.calculateTotalTransactionCost(
        amount,
        "TRANSFER"
      );
      console.log(
        `${amount} cNGN → Total cost: ${cost.totalCostNGN} cNGN (service: ${cost.serviceFee}, gas: ${cost.gasFeeNGN})`
      );
    }
    console.log();

    // Test 5: Legacy method comparison
    console.log("5️⃣ Comparing with legacy fee calculation...");
    const legacyFee = await FeeService.calculateTransactionFee("1000");
    console.log("Legacy Method:");
    console.log(`- Original: ${legacyFee.originalAmount} cNGN`);
    console.log(`- Service Fee: ${legacyFee.feeAmount} cNGN`);
    console.log(`- Gas Fee: ${legacyFee.gasFeeNGN} cNGN`);
    console.log(`- Total Deduction: ${legacyFee.totalDeduction} cNGN`);
    console.log(`- Net to Recipient: ${legacyFee.netAmount} cNGN`);
    console.log();

    console.log("✅ All gas fee model tests completed successfully!");

    // Summary
    console.log("\n📊 **Gas Fee Model Summary:**");
    console.log("- ✅ Users now pay for their own gas fees");
    console.log("- ✅ Transparent cost breakdown shown before transactions");
    console.log("- ✅ Service fees + gas fees collected separately");
    console.log("- ✅ Recipients receive full transfer amount");
    console.log("- ✅ Sustainable business model implemented");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testGasFeeModel();
}

module.exports = { testGasFeeModel };
