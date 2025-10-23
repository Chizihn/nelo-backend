import { PrivyClient, APIError, PrivyAPIError, User } from "@privy-io/node";
import { ethers } from "ethers";
import { logger } from "@/utils/logger";
import { config } from "dotenv";

config();

// Define custom type to reflect API response with wallets
interface PrivyUserResponse extends User {
  wallets?: { id: string; address: string; chain_type: string }[];
}

export interface PrivyWallet {
  address: string;
  walletClientType: string;
  connectorType: string;
  recoveryMethod: string;
}

export interface PrivyUser {
  id: string;
  createdAt: string;
  linkedAccounts: any[];
  wallet?: PrivyWallet;
}

export class PrivyService {
  private static instance: PrivyService;
  private privy: PrivyClient;
  private provider: ethers.JsonRpcProvider;

  constructor() {
    if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
      throw new Error(
        "Privy configuration missing. Please set PRIVY_APP_ID and PRIVY_APP_SECRET"
      );
    }

    this.privy = new PrivyClient({
      appId: process.env.PRIVY_APP_ID,
      appSecret: process.env.PRIVY_APP_SECRET,
    });

    // Use Alchemy for Base Sepolia (preferred over public RPC for reliability)
    const rpcUrl = process.env.BASE_RPC_URL || "https://sepolia.base.org";
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  static getInstance(): PrivyService {
    if (!PrivyService.instance) {
      PrivyService.instance = new PrivyService();
    }
    return PrivyService.instance;
  }

  /**
   * Extract wallet address from Privy user response
   */
  private extractWalletAddress(user: any): string | undefined {
    // First check linked_accounts for embedded wallet (current API format)
    const walletAccount = user.linked_accounts?.find(
      (account: any) =>
        account.type === "wallet" && account.chain_type === "ethereum"
    );

    if (walletAccount?.address) {
      return walletAccount.address;
    }

    // Fallback to wallets field (older API format)
    const wallet = user.wallets?.[0];
    return wallet?.address;
  }

  /**
   * Extract wallet ID from Privy user response
   */
  private extractWalletId(user: any): string | undefined {
    // First check linked_accounts for embedded wallet (current API format)
    const walletAccount = user.linked_accounts?.find(
      (account: any) =>
        account.type === "wallet" && account.chain_type === "ethereum"
    );

    if (walletAccount?.id) {
      return walletAccount.id;
    }

    // Fallback to wallets field (older API format)
    const wallet = user.wallets?.find((w: any) => w.chain_type === "ethereum");
    return wallet?.id;
  }

  /**
   * Create a new Privy user with linked WhatsApp and pre-generated embedded Ethereum wallet
   */
  async createUserWithWallet(whatsappNumber: string): Promise<{
    success: boolean;
    user?: PrivyUser;
    error?: string;
  }> {
    try {
      logger.info(`Creating Privy user for WhatsApp: ${whatsappNumber}`);

      // Create user with embedded wallet directly
      const user = (await this.privy.users().create({
        linked_accounts: [
          { type: "custom_auth", custom_user_id: whatsappNumber },
        ],
        wallets: [{ chain_type: "ethereum" }], // This creates embedded wallet
      })) as any;

      logger.info(`Privy user created with ID: ${user.id}`);
      logger.debug("User creation response:", JSON.stringify(user, null, 2));

      // Extract wallet address using helper method
      const walletAddress = this.extractWalletAddress(user);

      if (walletAddress) {
        logger.info(`Wallet found: ${walletAddress}`);
      } else {
        logger.error("No wallet found in user creation response", {
          linked_accounts: user.linked_accounts,
          wallets: user.wallets,
        });
        return {
          success: false,
          error: "No wallet address found in user creation response",
        };
      }

      logger.info(`Final wallet address: ${walletAddress}`);

      return {
        success: true,
        user: {
          id: user.id,
          createdAt: user.created_at || new Date().toISOString(),
          linkedAccounts: user.linked_accounts || [],
          wallet: {
            address: walletAddress,
            walletClientType: "embedded",
            connectorType: "privy",
            recoveryMethod: "privy-v2",
          },
        } as PrivyUser,
      };
    } catch (error) {
      logger.error("Error creating Privy user:", error);
      let errorMsg = "Failed to create Privy user";
      if (error instanceof APIError) {
        errorMsg = `API Error: ${error.status} - ${error.name}`;
      } else if (error instanceof PrivyAPIError) {
        errorMsg = `Privy Error: ${error.message}`;
      } else if (error instanceof Error) {
        errorMsg = error.message;
      }
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get existing Privy user by ID
   */
  async getUserById(userId: string): Promise<{
    success: boolean;
    user?: PrivyUser;
    error?: string;
  }> {
    try {
      // List users and find by ID (no direct get method available)
      const users: PrivyUserResponse[] = [];
      const usersCursor = await this.privy.users().list();
      for await (const user of usersCursor) {
        users.push(user as PrivyUserResponse);
      }

      const user = users.find((u) => u.id === userId);

      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Debug: Log raw user response to verify wallets field
      logger.debug("Raw user response:", JSON.stringify(user, null, 2));

      // Extract wallet address using helper method
      const walletAddress = this.extractWalletAddress(user);

      return {
        success: true,
        user: {
          id: user.id,
          createdAt: user.created_at || new Date().toISOString(),
          linkedAccounts: user.linked_accounts || [],
          wallet: walletAddress
            ? {
                address: walletAddress,
                walletClientType: "embedded",
                connectorType: "privy",
                recoveryMethod: "privy-v2",
              }
            : undefined,
        } as PrivyUser,
      };
    } catch (error) {
      logger.error("Error getting Privy user by ID:", error);
      let errorMsg = "Failed to get Privy user";
      if (error instanceof APIError) {
        errorMsg = `API Error: ${error.status} - ${error.name}`;
      } else if (error instanceof PrivyAPIError) {
        errorMsg = `Privy Error: ${error.message}`;
      } else if (error instanceof Error) {
        errorMsg = error.message;
      }
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get existing Privy user by WhatsApp number (client-side filter from list)
   */
  async getUserByPhone(whatsappNumber: string): Promise<{
    success: boolean;
    user?: PrivyUser;
    error?: string;
  }> {
    try {
      // List users (UsersCursor requires async iteration)
      const users: PrivyUserResponse[] = [];
      const usersCursor = await this.privy.users().list();
      for await (const user of usersCursor) {
        users.push(user as PrivyUserResponse);
      }

      const user = users.find((u) =>
        u.linked_accounts?.some(
          (acc) =>
            acc.type === "custom_auth" &&
            (acc as any).custom_user_id === whatsappNumber
        )
      );

      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Debug: Log raw user response to verify wallets field
      logger.debug("Raw user response:", JSON.stringify(user, null, 2));

      // Extract wallet address using helper method
      const walletAddress = this.extractWalletAddress(user);

      return {
        success: true,
        user: {
          id: user.id,
          createdAt: user.created_at || new Date().toISOString(),
          linkedAccounts: user.linked_accounts || [],
          wallet: walletAddress
            ? {
                address: walletAddress,
                walletClientType: "embedded",
                connectorType: "privy",
                recoveryMethod: "privy-v2",
              }
            : undefined,
        } as PrivyUser,
      };
    } catch (error) {
      logger.error("Error getting Privy user:", error);
      let errorMsg = "Failed to get Privy user";
      if (error instanceof APIError) {
        errorMsg = `API Error: ${error.status} - ${error.name}`;
      } else if (error instanceof PrivyAPIError) {
        errorMsg = `Privy Error: ${error.message}`;
      } else if (error instanceof Error) {
        errorMsg = error.message;
      }
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Send (sign + broadcast) transaction using Privy embedded wallet
   */
  async signTransaction(
    userId: string,
    transaction: {
      to: string;
      value?: string;
      data?: string;
    }
  ): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    try {
      // Find user by ID (no direct get; use list)
      const users: PrivyUserResponse[] = [];
      const usersCursor = await this.privy.users().list();
      for await (const user of usersCursor) {
        users.push(user as PrivyUserResponse);
      }
      const user = users.find((u) => u.id === userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Debug: Log raw user response to verify wallets field
      logger.debug("Raw user response:", JSON.stringify(user, null, 2));

      // Extract wallet ID using helper method
      const walletId = this.extractWalletId(user);

      if (!walletId) {
        return { success: false, error: "No Ethereum wallet found for user" };
      }

      const caip2 = "eip155:84532"; // Base Sepolia

      const response = await this.privy
        .wallets()
        .ethereum()
        .sendTransaction(walletId, {
          caip2,
          params: {
            transaction: {
              to: transaction.to,
              value: transaction.value || "0x0",
              data: transaction.data || "0x",
              chain_id: 84532, // Base Sepolia
            },
          },
        });

      logger.info(`Transaction sent for user ${userId}: ${response.hash}`);

      return {
        success: true,
        txHash: response.hash,
      };
    } catch (error) {
      logger.error("Error sending transaction with Privy:", error);
      let errorMsg = "Failed to send transaction";
      if (error instanceof APIError) {
        errorMsg = `API Error: ${error.status} - ${error.name}`;
      } else if (error instanceof PrivyAPIError) {
        errorMsg = `Privy Error: ${error.message}`;
      } else if (error instanceof Error) {
        errorMsg = error.message;
      }
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get user's wallet balance (native ETH or ERC-20)
   */
  async getWalletBalance(
    userId: string,
    tokenAddress?: string
  ): Promise<{
    success: boolean;
    balance?: string;
    error?: string;
  }> {
    try {
      // Find user by ID (no direct get; use list)
      const users: PrivyUserResponse[] = [];
      const usersCursor = await this.privy.users().list();
      for await (const user of usersCursor) {
        users.push(user as PrivyUserResponse);
      }
      const user = users.find((u) => u.id === userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Debug: Log raw user response to verify wallets field
      logger.debug("Raw user response:", JSON.stringify(user, null, 2));

      // Extract wallet address using helper method
      const walletAddress = this.extractWalletAddress(user);

      if (!walletAddress) {
        return { success: false, error: "No wallet found for user" };
      }

      logger.info(
        `Fetching balance for user ${userId} wallet ${walletAddress}`
      );

      let balance: string;

      if (tokenAddress) {
        // ERC-20 balance
        const erc20Abi = [
          "function balanceOf(address account) view returns (uint256)",
        ];
        const tokenContract = new ethers.Contract(
          tokenAddress,
          erc20Abi,
          this.provider
        );
        const balanceWei = await tokenContract.balanceOf(walletAddress);
        balance = ethers.formatUnits(balanceWei, 18); // Assume 18 decimals; fetch dynamically if needed
      } else {
        // Native ETH balance
        const balanceWei = await this.provider.getBalance(walletAddress);
        balance = ethers.formatEther(balanceWei);
      }

      return { success: true, balance };
    } catch (error) {
      logger.error("Error getting wallet balance:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get balance",
      };
    }
  }
}

export const privyService = PrivyService.getInstance();
