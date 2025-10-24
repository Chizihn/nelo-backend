import { ethers } from "ethers";
import {
  CONTRACT_ADDRESSES,
  CONTRACT_ABIS,
  provider,
  GAS_SETTINGS,
} from "@/config/blockchain";
import { WalletService } from "./walletService";
import { ContractCallResult } from "@/types/blockchain.types";
import { logger } from "@/utils/logger";
import { CONSTANTS } from "@/utils/constants";

export class NeloContractService {
  private static getNeloContract(
    signerOrProvider?: ethers.Signer | ethers.Provider
  ) {
    if (!CONTRACT_ADDRESSES.NELO_CUSTODY) {
      throw new Error("Nelo custody contract address not configured");
    }

    return new ethers.Contract(
      CONTRACT_ADDRESSES.NELO_CUSTODY,
      CONTRACT_ABIS.NELO_CUSTODY,
      signerOrProvider || provider
    );
  }

  /**
   * Enhanced retry logic for blockchain calls with better error handling
   */
  private static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
    operation: string = "blockchain operation"
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        // Log detailed error info
        logger.warn(`${operation} failed (attempt ${i + 1}/${maxRetries}):`, {
          error: error instanceof Error ? error.message : "Unknown error",
          operation,
          attempt: i + 1,
          maxRetries,
          delayMs,
        });

        // Check if error is retriable
        if (
          error instanceof Error &&
          (error.message.includes("timeout") ||
            error.message.includes("network") ||
            error.message.includes("rate limit") ||
            error.message.toLowerCase().includes("nonce"))
        ) {
          if (i === maxRetries - 1) {
            logger.error(`${operation} failed after ${maxRetries} retries`);
            throw error;
          }

          // Wait with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2; // Exponential backoff
          continue;
        }

        // Non-retriable error
        logger.error(`${operation} failed with non-retriable error:`, error);
        throw error;
      }
    }
    throw new Error(`${operation}: Max retries exceeded`);
  }

  /**
   * Deposit cNGN tokens to Nelo custody contract
   */
  static async depositTokens(
    encryptedPrivateKey: string,
    tokenAddress: string,
    amount: string
  ): Promise<ContractCallResult> {
    try {
      const wallet = WalletService.getWalletInstance(encryptedPrivateKey);
      const contract = this.getNeloContract(wallet);

      // Get token decimals from config
      const decimals =
        tokenAddress.toLowerCase() ===
        CONTRACT_ADDRESSES.CNGN_TOKEN?.toLowerCase()
          ? 6
          : 6;
      const amountWei = ethers.parseUnits(amount, decimals);

      const tx = await contract.deposit(tokenAddress, amountWei, {
        ...GAS_SETTINGS,
      });

      logger.info(`Nelo deposit initiated: ${tx.hash}`);

      // Add timeout and retry logic for transaction confirmation
      const receipt = await this.retryWithBackoff(() =>
        Promise.race([
          tx.wait(CONSTANTS.CONFIRMATION_BLOCKS),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Transaction confirmation timeout")),
              60000
            )
          ),
        ])
      );

      if (!receipt) {
        throw new Error("Transaction failed - no receipt received");
      }

      if (receipt.status === 0) {
        throw new Error("Transaction reverted on-chain");
      }

      return {
        success: true,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      logger.error("Nelo deposit failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Deposit failed",
      };
    }
  }

  /**
   * Withdraw tokens from Nelo custody
   */
  static async withdrawTokens(
    encryptedPrivateKey: string,
    tokenAddress: string,
    amount: string,
    toAddress: string
  ): Promise<ContractCallResult> {
    try {
      const wallet = WalletService.getWalletInstance(encryptedPrivateKey);
      const contract = this.getNeloContract(wallet);

      const amountWei = ethers.parseUnits(amount, CONSTANTS.CNGN_DECIMALS);

      const tx = await contract.withdraw(tokenAddress, amountWei, toAddress, {
        ...GAS_SETTINGS,
      });

      logger.info(`Nelo withdrawal initiated: ${tx.hash}`);

      // Add timeout and null check for transaction confirmation
      const receipt = await Promise.race([
        tx.wait(CONSTANTS.CONFIRMATION_BLOCKS),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Transaction confirmation timeout")),
            60000
          )
        ),
      ]);

      if (!receipt) {
        throw new Error("Transaction failed - no receipt received");
      }

      if (receipt.status === 0) {
        throw new Error("Transaction reverted on-chain");
      }

      return {
        success: true,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      logger.error("Nelo withdrawal failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Withdrawal failed",
      };
    }
  }

  /**
   * Get user's token balance in Nelo custody
   */
  static async getUserBalance(
    userAddress: string,
    tokenAddress: string
  ): Promise<string> {
    try {
      const contract = this.getNeloContract();
      const balance = await contract.balanceOf(userAddress, tokenAddress);

      // Both tokens use 6 decimals
      const decimals = 6;

      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      logger.error("Failed to get Nelo balance:", error);
      throw new Error("Failed to fetch custody balance");
    }
  }

  /**
   * Check if a token is whitelisted in the Nelo custody contract
   */
  static async isTokenWhitelisted(tokenAddress: string): Promise<boolean> {
    try {
      const contract = this.getNeloContract();
      const isWhitelisted = await contract.tokenWhitelisted(tokenAddress);
      logger.info(`Token ${tokenAddress} whitelisted status: ${isWhitelisted}`);
      return isWhitelisted;
    } catch (error) {
      logger.error("Failed to check token whitelist status:", error);
      return false; // Default to false if check fails
    }
  }

  /**
   * Transfer tokens to custodian (operator only)
   * This would be used for off-ramp operations
   */
  static async transferToCustodian(
    operatorPrivateKey: string,
    userAddress: string,
    tokenAddress: string,
    amount: string,
    custodianAddress: string
  ): Promise<ContractCallResult> {
    try {
      const wallet = WalletService.getWalletInstance(operatorPrivateKey);
      const contract = this.getNeloContract(wallet);

      const amountWei = ethers.parseUnits(amount, CONSTANTS.CNGN_DECIMALS);

      const tx = await contract.transferToCustodian(
        userAddress,
        tokenAddress,
        amountWei,
        custodianAddress,
        {
          ...GAS_SETTINGS,
        }
      );

      logger.info(`Nelo custodian transfer initiated: ${tx.hash}`);

      // Add timeout and null check for transaction confirmation
      const receipt = await Promise.race([
        tx.wait(CONSTANTS.CONFIRMATION_BLOCKS),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Transaction confirmation timeout")),
            60000
          )
        ),
      ]);

      if (!receipt) {
        throw new Error("Transaction failed - no receipt received");
      }

      if (receipt.status === 0) {
        throw new Error("Transaction reverted on-chain");
      }

      return {
        success: true,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      logger.error("Nelo custodian transfer failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Transfer failed",
      };
    }
  }

  /**
   * Batch get balances for multiple users and tokens
   */
  static async batchGetBalances(
    userAddresses: string[],
    tokenAddresses: string[]
  ): Promise<string[]> {
    try {
      const contract = this.getNeloContract();
      const balances = await contract.batchBalances(
        userAddresses,
        tokenAddresses
      );

      return balances.map((balance: bigint) =>
        ethers.formatUnits(balance, CONSTANTS.CNGN_DECIMALS)
      );
    } catch (error) {
      logger.error("Failed to batch get balances:", error);
      return [];
    }
  }

  /**
   * Listen for Nelo contract events
   */
  static setupEventListeners(callback: (event: any) => void) {
    try {
      const contract = this.getNeloContract();

      // Listen for Deposited events
      contract.on("Deposited", (user, token, amount, event) => {
        callback({
          type: "Deposited",
          user,
          token,
          amount: ethers.formatUnits(amount, CONSTANTS.CNGN_DECIMALS),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
        });
      });

      // Listen for Withdrawn events
      contract.on("Withdrawn", (user, token, amount, to, event) => {
        callback({
          type: "Withdrawn",
          user,
          token,
          amount: ethers.formatUnits(amount, CONSTANTS.CNGN_DECIMALS),
          to,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
        });
      });

      // Listen for TransferToCustodian events
      contract.on(
        "TransferToCustodian",
        (user, token, amount, custodian, event) => {
          callback({
            type: "TransferToCustodian",
            user,
            token,
            amount: ethers.formatUnits(amount, CONSTANTS.CNGN_DECIMALS),
            custodian,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
          });
        }
      );

      logger.info("Nelo contract event listeners setup successfully");
    } catch (error) {
      logger.error("Failed to setup Nelo event listeners:", error);
    }
  }
}
