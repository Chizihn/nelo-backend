import { ethers } from "ethers";
import {
  CONTRACT_ADDRESSES,
  CONTRACT_ABIS,
  provider,
  GAS_SETTINGS,
  CHAIN_CONFIG,
} from "@/config/blockchain";
import { WalletService } from "./walletService";
import { TokenBalance, ContractCallResult } from "@/types/blockchain.types";
import { logger } from "@/utils/logger";
import { CONSTANTS } from "@/utils/constants";

export class CngnService {
  // cNGN Contract addresses on different networks
  private static readonly CNGN_ADDRESSES = {
    // Base Mainnet
    8453: "0x", // TODO: Add actual Base mainnet cNGN address when available
    // Base Sepolia Testnet
    84532: "0x", // TODO: Add actual Base Sepolia cNGN address when available
  };

  private static getContract(
    signerOrProvider?: ethers.Signer | ethers.Provider
  ) {
    // Use configured address or fallback to known addresses
    const contractAddress =
      CONTRACT_ADDRESSES.CNGN_TOKEN ||
      this.CNGN_ADDRESSES[parseInt(CHAIN_CONFIG.chainId) as 8453 | 84532];

    if (!contractAddress || contractAddress === "0x") {
      throw new Error(
        `cNGN token contract address not configured for chain ${CHAIN_CONFIG.chainId}`
      );
    }

    return new ethers.Contract(
      contractAddress,
      CONTRACT_ABIS.CNGN_TOKEN,
      signerOrProvider || provider
    );
  }

  /**
   * Get cNGN balance for an address
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
      logger.error("Failed to get cNGN balance:", error);
      throw new Error("Failed to fetch cNGN balance");
    }
  }

  /**
   * Transfer cNGN tokens
   */
  static async transfer(
    encryptedPrivateKey: string,
    toAddress: string,
    amount: string
  ): Promise<ContractCallResult> {
    try {
      const wallet = WalletService.getWalletInstance(encryptedPrivateKey);
      const contract = this.getContract(wallet);

      // Convert amount to wei (18 decimals for cNGN)
      const amountWei = ethers.parseUnits(amount, CONSTANTS.CNGN_DECIMALS);

      // Check balance first
      const balance = await contract.balanceOf(wallet.address);
      if (balance < amountWei) {
        return {
          success: false,
          error: "Insufficient cNGN balance",
        };
      }

      // Execute transfer
      const tx = await contract.transfer(toAddress, amountWei, {
        ...GAS_SETTINGS,
      });

      logger.info(`cNGN transfer initiated: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait(CONSTANTS.CONFIRMATION_BLOCKS);

      return {
        success: true,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      logger.error("cNGN transfer failed:", error);
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

      const amountWei = ethers.parseUnits(amount, CONSTANTS.CNGN_DECIMALS);

      const tx = await contract.approve(spenderAddress, amountWei, {
        ...GAS_SETTINGS,
      });

      logger.info(`cNGN approval initiated: ${tx.hash}`);

      const receipt = await tx.wait(CONSTANTS.CONFIRMATION_BLOCKS);

      return {
        success: true,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      logger.error("cNGN approval failed:", error);
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
      return ethers.formatUnits(allowance, CONSTANTS.CNGN_DECIMALS);
    } catch (error) {
      logger.error("Failed to get allowance:", error);
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
      logger.error("Failed to get token info:", error);
      throw new Error("Failed to fetch token information");
    }
  }

  /**
   * Format cNGN amount for display
   */
  static formatAmount(
    amount: string,
    decimals: number = CONSTANTS.CNGN_DECIMALS
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
   * Parse cNGN amount from string
   */
  static parseAmount(amount: string): string {
    try {
      return ethers.parseUnits(amount, CONSTANTS.CNGN_DECIMALS).toString();
    } catch (error) {
      throw new Error("Invalid amount format");
    }
  }

  /**
   * Validate cNGN amount
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
}
