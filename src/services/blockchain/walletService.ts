import { ethers } from "ethers";
import { WalletInfo } from "@/types/blockchain.types";
import { EncryptionService } from "@/utils/encryption";
import { logger } from "@/utils/logger";
import { provider } from "@/config/blockchain";

export class WalletService {
  /**
   * Generate a new wallet with private key, public key, and address
   */
  static generateWallet(): WalletInfo {
    try {
      const wallet = ethers.Wallet.createRandom();

      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: wallet.signingKey.publicKey,
      };
    } catch (error) {
      logger.error("Failed to generate wallet:", error);
      throw new Error("Wallet generation failed");
    }
  }

  /**
   * Create wallet from private key
   */
  static fromPrivateKey(privateKey: string): WalletInfo {
    try {
      const wallet = new ethers.Wallet(privateKey);

      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: wallet.signingKey.publicKey,
      };
    } catch (error) {
      logger.error("Failed to create wallet from private key:", error);
      throw new Error("Invalid private key");
    }
  }

  /**
   * Get wallet instance for transactions
   */
  static getWalletInstance(encryptedPrivateKey: string): ethers.Wallet {
    try {
      const privateKey = EncryptionService.decrypt(encryptedPrivateKey);
      return new ethers.Wallet(privateKey, provider);
    } catch (error) {
      logger.error("Failed to get wallet instance:", error);
      throw new Error("Failed to decrypt wallet");
    }
  }

  /**
   * Get ETH balance for an address
   */
  static async getEthBalance(address: string): Promise<string> {
    try {
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error("Failed to get ETH balance:", error);
      throw new Error("Failed to fetch ETH balance");
    }
  }

  /**
   * Validate Ethereum address
   */
  static isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Sign message with wallet
   */
  static async signMessage(
    encryptedPrivateKey: string,
    message: string
  ): Promise<string> {
    try {
      const wallet = this.getWalletInstance(encryptedPrivateKey);
      return await wallet.signMessage(message);
    } catch (error) {
      logger.error("Failed to sign message:", error);
      throw new Error("Message signing failed");
    }
  }

  /**
   * Verify message signature
   */
  static verifyMessage(
    message: string,
    signature: string,
    address: string
  ): boolean {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      logger.error("Failed to verify message:", error);
      return false;
    }
  }

  /**
   * Encrypt private key for storage
   */
  static encryptPrivateKey(privateKey: string): string {
    return EncryptionService.encrypt(privateKey);
  }

  /**
   * Get transaction count (nonce) for address
   */
  static async getNonce(address: string): Promise<number> {
    try {
      return await provider.getTransactionCount(address, "pending");
    } catch (error) {
      logger.error("Failed to get nonce:", error);
      throw new Error("Failed to fetch nonce");
    }
  }

  /**
   * Estimate gas for transaction
   */
  static async estimateGas(transaction: any): Promise<bigint> {
    try {
      return await provider.estimateGas(transaction);
    } catch (error) {
      logger.error("Failed to estimate gas:", error);
      throw new Error("Gas estimation failed");
    }
  }
}
