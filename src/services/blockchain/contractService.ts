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

export class ContractService {
  private static getVirtualCardContract(
    signerOrProvider?: ethers.Signer | ethers.Provider
  ) {
    if (!CONTRACT_ADDRESSES.VIRTUAL_CARD) {
      throw new Error("Virtual Card contract address not configured");
    }

    return new ethers.Contract(
      CONTRACT_ADDRESSES.VIRTUAL_CARD,
      CONTRACT_ABIS.VIRTUAL_CARD,
      signerOrProvider || provider
    );
  }

  /**
   * Create a new virtual card NFT
   */
  static async createCard(
    encryptedPrivateKey: string,
    ownerAddress: string
  ): Promise<ContractCallResult<{ tokenId: string }>> {
    try {
      const wallet = WalletService.getWalletInstance(encryptedPrivateKey);
      const contract = this.getVirtualCardContract(wallet);

      const tx = await contract.createCard(ownerAddress, {
        ...GAS_SETTINGS,
      });

      logger.info(`Virtual card creation initiated: ${tx.hash}`);

      const receipt = await tx.wait(CONSTANTS.CONFIRMATION_BLOCKS);

      // Extract tokenId from events
      const cardCreatedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog({
            topics: log.topics,
            data: log.data,
          });
          return parsed?.name === "CardCreated";
        } catch {
          return false;
        }
      });

      let tokenId = "";
      if (cardCreatedEvent) {
        const parsed = contract.interface.parseLog({
          topics: cardCreatedEvent.topics,
          data: cardCreatedEvent.data,
        });
        tokenId = parsed?.args?.tokenId?.toString() || "";
      }

      return {
        success: true,
        data: { tokenId },
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      logger.error("Virtual card creation failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Card creation failed",
      };
    }
  }

  /**
   * Get card balance from contract
   */
  static async getCardBalance(tokenId: string): Promise<string> {
    try {
      const contract = this.getVirtualCardContract();
      const balance = await contract.getCardBalance(tokenId);
      return ethers.formatUnits(balance, CONSTANTS.CNGN_DECIMALS);
    } catch (error) {
      logger.error("Failed to get card balance:", error);
      throw new Error("Failed to fetch card balance");
    }
  }

  /**
   * Deposit cNGN to virtual card
   */
  static async depositToCard(
    encryptedPrivateKey: string,
    tokenId: string,
    amount: string
  ): Promise<ContractCallResult> {
    try {
      const wallet = WalletService.getWalletInstance(encryptedPrivateKey);
      const contract = this.getVirtualCardContract(wallet);

      const amountWei = ethers.parseUnits(amount, CONSTANTS.CNGN_DECIMALS);

      const tx = await contract.deposit(tokenId, amountWei, {
        ...GAS_SETTINGS,
      });

      logger.info(`Card deposit initiated: ${tx.hash}`);

      const receipt = await tx.wait(CONSTANTS.CONFIRMATION_BLOCKS);

      return {
        success: true,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      logger.error("Card deposit failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Deposit failed",
      };
    }
  }

  /**
   * Process payment from virtual card
   */
  static async processPayment(
    encryptedPrivateKey: string,
    tokenId: string,
    amount: string,
    merchantAddress: string
  ): Promise<ContractCallResult> {
    try {
      const wallet = WalletService.getWalletInstance(encryptedPrivateKey);
      const contract = this.getVirtualCardContract(wallet);

      const amountWei = ethers.parseUnits(amount, CONSTANTS.CNGN_DECIMALS);

      // Check card balance first
      const balance = await contract.getCardBalance(tokenId);
      if (balance < amountWei) {
        return {
          success: false,
          error: "Insufficient card balance",
        };
      }

      const tx = await contract.processPayment(
        tokenId,
        amountWei,
        merchantAddress,
        {
          ...GAS_SETTINGS,
        }
      );

      logger.info(`Card payment initiated: ${tx.hash}`);

      const receipt = await tx.wait(CONSTANTS.CONFIRMATION_BLOCKS);

      return {
        success: true,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      logger.error("Card payment failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment failed",
      };
    }
  }

  /**
   * Get card owner
   */
  static async getCardOwner(tokenId: string): Promise<string> {
    try {
      const contract = this.getVirtualCardContract();
      return await contract.getCardOwner(tokenId);
    } catch (error) {
      logger.error("Failed to get card owner:", error);
      throw new Error("Failed to fetch card owner");
    }
  }

  /**
   * Check if card is active
   */
  static async isCardActive(tokenId: string): Promise<boolean> {
    try {
      const contract = this.getVirtualCardContract();
      return await contract.isCardActive(tokenId);
    } catch (error) {
      logger.error("Failed to check card status:", error);
      return false;
    }
  }

  /**
   * Listen for contract events
   */
  static setupEventListeners(callback: (event: any) => void) {
    try {
      const contract = this.getVirtualCardContract();

      // Listen for CardCreated events
      contract.on("CardCreated", (tokenId, owner, event) => {
        callback({
          type: "CardCreated",
          tokenId: tokenId.toString(),
          owner,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
        });
      });

      // Listen for Deposit events
      contract.on("Deposit", (tokenId, amount, event) => {
        callback({
          type: "Deposit",
          tokenId: tokenId.toString(),
          amount: ethers.formatUnits(amount, CONSTANTS.CNGN_DECIMALS),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
        });
      });

      // Listen for Payment events
      contract.on("Payment", (tokenId, amount, merchant, event) => {
        callback({
          type: "Payment",
          tokenId: tokenId.toString(),
          amount: ethers.formatUnits(amount, CONSTANTS.CNGN_DECIMALS),
          merchant,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
        });
      });

      logger.info("Contract event listeners setup successfully");
    } catch (error) {
      logger.error("Failed to setup event listeners:", error);
    }
  }

  /**
   * Get past events for a card
   */
  static async getCardEvents(
    tokenId: string,
    fromBlock: number = 0
  ): Promise<any[]> {
    try {
      const contract = this.getVirtualCardContract();

      const filter = contract.filters.CardCreated(tokenId);
      const events = await contract.queryFilter(filter, fromBlock);

      return events.map((event: any) => ({
        type: event.eventName || "Unknown",
        args: event.args || [],
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
      }));
    } catch (error) {
      logger.error("Failed to get card events:", error);
      return [];
    }
  }
}
