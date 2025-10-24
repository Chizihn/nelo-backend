import { ethers } from "ethers";
import {
  CONTRACT_ADDRESSES,
  CONTRACT_ABIS,
  provider,
  GAS_SETTINGS,
  SUPPORTED_TOKENS,
} from "@/config/blockchain";
import { WalletService } from "./walletService";
import { TokenBalance, ContractCallResult } from "@/types/blockchain.types";
import { logger } from "@/utils/logger";
import { CONSTANTS } from "@/utils/constants";

export class UsdcService {
  private static getContract(
    signerOrProvider?: ethers.Signer | ethers.Provider
  ) {
    // Use environment variable for USDC address
    const contractAddress = CONTRACT_ADDRESSES.USDC_TOKEN;

    if (
      !contractAddress ||
      contractAddress === "0x" ||
      !contractAddress.startsWith("0x")
    ) {
      throw new Error(
        `USDC token contract address not configured. Set USDC_TOKEN_ADDRESS env var.`
      );
    }

    return new ethers.Contract(
      contractAddress,
      CONTRACT_ABIS.USDC_TOKEN,
      signerOrProvider || provider
    );
  }

  /**
   * Get USDC balance for an address
   */
  static async getBalance(address: string): Promise<TokenBalance> {
    try {
      const contract = this.getContract();

      const [balance, decimals, symbol, name] = await Promise.all([
        contract.balanceOf(address),
        contract.decimals(),
        contract.symbol(),
        contract.name(),
      ]);

      return {
        balance: ethers.formatUnits(balance, decimals),
        decimals: Number(decimals),
        symbol,
        name,
      };
    } catch (error) {
      logger.error("Failed to get USDC balance:", error);
      throw new Error("Failed to fetch USDC balance");
    }
  }

  /**
   * Transfer USDC tokens
   */
  static async transfer(
    encryptedPrivateKey: string,
    toAddress: string,
    amount: string
  ): Promise<ContractCallResult> {
    try {
      const wallet = WalletService.getWalletInstance(encryptedPrivateKey);
      const contract = this.getContract(wallet);

      // Convert amount to wei (6 decimals for USDC)
      const amountWei = ethers.parseUnits(
        amount,
        SUPPORTED_TOKENS.USDC.decimals
      );

      // Check balance first
      const balance = await contract.balanceOf(wallet.address);
      if (balance < amountWei) {
        return {
          success: false,
          error: "Insufficient USDC balance",
        };
      }

      // Execute transfer
      const tx = await contract.transfer(toAddress, amountWei, {
        ...GAS_SETTINGS,
      });

      logger.info(`USDC transfer initiated: ${tx.hash}`);

      // Add timeout and null check
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
        throw new Error("Transaction failed - no receipt");
      }

      if (receipt.status === 0) {
        throw new Error("Transaction reverted");
      }

      return {
        success: true,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      logger.error("USDC transfer failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Transfer failed",
      };
    }
  }

  /**
   * Approve spender to use tokens
   */
  static async approve(
    encryptedPrivateKey: string,
    spenderAddress: string,
    amount: string
  ): Promise<ContractCallResult> {
    try {
      const wallet = WalletService.getWalletInstance(encryptedPrivateKey);
      const contract = this.getContract(wallet);

      const amountWei = ethers.parseUnits(
        amount,
        SUPPORTED_TOKENS.USDC.decimals
      );

      const tx = await contract.approve(spenderAddress, amountWei, {
        ...GAS_SETTINGS,
      });

      logger.info(`USDC approval initiated: ${tx.hash}`);

      const receipt = await tx.wait(CONSTANTS.CONFIRMATION_BLOCKS);

      return {
        success: true,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      logger.error("USDC approval failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Approval failed",
      };
    }
  }

  /**
   * Get allowance amount
   */
  static async getAllowance(
    ownerAddress: string,
    spenderAddress: string
  ): Promise<string> {
    try {
      const contract = this.getContract();
      const allowance = await contract.allowance(ownerAddress, spenderAddress);
      return ethers.formatUnits(allowance, SUPPORTED_TOKENS.USDC.decimals);
    } catch (error) {
      logger.error("Failed to get USDC allowance:", error);
      throw new Error("Failed to fetch allowance");
    }
  }

  /**
   * Get token info
   */
  static async getTokenInfo(): Promise<{
    name: string;
    symbol: string;
    decimals: number;
    totalSupply?: string;
  }> {
    try {
      const contract = this.getContract();

      const [name, symbol, decimals] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
      ]);

      return {
        name,
        symbol,
        decimals: Number(decimals),
      };
    } catch (error) {
      logger.error("Failed to get USDC token info:", error);
      throw new Error("Failed to fetch token information");
    }
  }

  /**
   * Format USDC amount for display
   */
  static formatAmount(
    amount: string,
    decimals: number = SUPPORTED_TOKENS.USDC.decimals
  ): string {
    try {
      const formatted = ethers.formatUnits(amount, decimals);
      const num = parseFloat(formatted);

      // Format with appropriate decimal places
      if (num >= 1000000) {
        return `${(num / 1000000).toFixed(2)}M`;
      } else if (num >= 1000) {
        return `${(num / 1000).toFixed(2)}K`;
      } else if (num >= 1) {
        return num.toFixed(2);
      } else {
        return num.toFixed(6);
      }
    } catch (error) {
      return amount;
    }
  }

  /**
   * Parse USDC amount from string
   */
  static parseAmount(amount: string): string {
    try {
      return ethers
        .parseUnits(amount, SUPPORTED_TOKENS.USDC.decimals)
        .toString();
    } catch (error) {
      throw new Error("Invalid amount format");
    }
  }

  /**
   * Validate USDC amount
   */
  static isValidAmount(amount: string): boolean {
    try {
      const parsed = parseFloat(amount);
      return (
        parsed > 0 && parsed <= parseFloat(CONSTANTS.MAX_TRANSACTION_AMOUNT)
      );
    } catch {
      return false;
    }
  }

  /**
   * NO MINT FUNCTION - USDC is real token
   * Users get USDC from faucet.circle.com or other sources
   */
  // static async mintToUser() - NOT IMPLEMENTED
  // USDC cannot be minted by our service
}
