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
  private static getContract(
    signerOrProvider?: ethers.Signer | ethers.Provider
  ) {
    // Use environment variable for cNGN address
    const contractAddress = CONTRACT_ADDRESSES.CNGN_TOKEN;

    if (
      !contractAddress ||
      contractAddress === "0x" ||
      !contractAddress.startsWith("0x")
    ) {
      throw new Error(
        `cNGN token contract address not configured. Set CNGN_TOKEN_ADDRESS env var.`
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

      // Fixed decimals to 6 for cNGN
      const [balance, symbol, name] = await Promise.all([
        contract.balanceOf(address),
        contract.symbol(),
        contract.name(),
      ]);

      return {
        balance: ethers.formatUnits(balance, 6), // Fixed 6 decimals for cNGN
        decimals: 6,
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
      const amountWei = ethers.parseUnits(amount, 6); // cNGN uses 6 decimals like USDC

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

      const amountWei = ethers.parseUnits(amount, 6); // Fixed to 6 decimals

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
      return ethers.formatUnits(allowance, 6); // Fixed to 6 decimals
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
    decimals: number = 6 // Fixed to 6 decimals
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
      return ethers.parseUnits(amount, 6).toString(); // Fixed to 6 decimals
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

  /**
   * Mint cNGN tokens to user (for onramp)
   * Uses dedicated minter wallet — NOT deployer
   */
  static async mintToUser(
    userAddress: string,
    amount: string
  ): Promise<ContractCallResult> {
    try {
      const minterKey = process.env.CNGN_MINTER_PRIVATE_KEY;
      if (!minterKey) {
        throw new Error("CNGN_MINTER_PRIVATE_KEY not set in .env");
      }

      const wallet = new ethers.Wallet(minterKey, provider);
      const contract = this.getContract(wallet);

      const amountWei = ethers.parseUnits(amount, 6); // Fixed to 6 decimals

      logger.info(
        `Minting ${amount} cNGN to ${userAddress} from ${wallet.address}`
      );

      const tx = await contract.mint(userAddress, amountWei, {
        ...GAS_SETTINGS,
      });

      const receipt = await tx.wait();

      logger.info(`cNGN minted! TX: ${receipt.hash}`);
      return {
        success: true,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      logger.error("Mint failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Mint failed",
      };
    }
  }
}
