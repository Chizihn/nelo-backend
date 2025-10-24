import { CngnService } from "./cngnService";
import { UsdcService } from "./usdcService";
import { SUPPORTED_TOKENS } from "@/config/blockchain";
import { TokenBalance, ContractCallResult } from "@/types/blockchain.types";
import { logger } from "@/utils/logger";

export type SupportedToken = "cNGN" | "USDC";

export class TokenService {
  /**
   * Get token service instance based on token type
   */
  private static getTokenService(token: SupportedToken) {
    switch (token.toUpperCase()) {
      case "CNGN":
        return CngnService;
      case "USDC":
        return UsdcService;
      default:
        throw new Error(`Unsupported token: ${token}`);
    }
  }

  /**
   * Get token configuration
   */
  static getTokenConfig(token: SupportedToken) {
    const tokenKey = token.toUpperCase() as keyof typeof SUPPORTED_TOKENS;
    const config = SUPPORTED_TOKENS[tokenKey];

    if (!config) {
      throw new Error(`Token configuration not found: ${token}`);
    }

    return config;
  }

  /**
   * Get balance for any supported token
   */
  static async getBalance(
    address: string,
    token: SupportedToken
  ): Promise<TokenBalance> {
    try {
      const service = this.getTokenService(token);
      return await service.getBalance(address);
    } catch (error) {
      logger.error(`Failed to get ${token} balance:`, error);
      throw error;
    }
  }

  /**
   * Transfer any supported token
   */
  static async transfer(
    encryptedPrivateKey: string,
    toAddress: string,
    amount: string,
    token: SupportedToken
  ): Promise<ContractCallResult> {
    try {
      const service = this.getTokenService(token);
      return await service.transfer(encryptedPrivateKey, toAddress, amount);
    } catch (error) {
      logger.error(`Failed to transfer ${token}:`, error);
      throw error;
    }
  }

  /**
   * Approve spender for any supported token
   */
  static async approve(
    encryptedPrivateKey: string,
    spenderAddress: string,
    amount: string,
    token: SupportedToken
  ): Promise<ContractCallResult> {
    try {
      const service = this.getTokenService(token);
      return await service.approve(encryptedPrivateKey, spenderAddress, amount);
    } catch (error) {
      logger.error(`Failed to approve ${token}:`, error);
      throw error;
    }
  }

  /**
   * Get allowance for any supported token
   */
  static async getAllowance(
    ownerAddress: string,
    spenderAddress: string,
    token: SupportedToken
  ): Promise<string> {
    try {
      const service = this.getTokenService(token);
      return await service.getAllowance(ownerAddress, spenderAddress);
    } catch (error) {
      logger.error(`Failed to get ${token} allowance:`, error);
      throw error;
    }
  }

  /**
   * Get token info for any supported token
   */
  static async getTokenInfo(token: SupportedToken) {
    try {
      const service = this.getTokenService(token);
      return await service.getTokenInfo();
    } catch (error) {
      logger.error(`Failed to get ${token} info:`, error);
      throw error;
    }
  }

  /**
   * Format amount for display
   */
  static formatAmount(amount: string, token: SupportedToken): string {
    try {
      const service = this.getTokenService(token);
      return service.formatAmount(amount);
    } catch (error) {
      logger.error(`Failed to format ${token} amount:`, error);
      return amount;
    }
  }

  /**
   * Parse amount from string
   */
  static parseAmount(amount: string, token: SupportedToken): string {
    try {
      const service = this.getTokenService(token);
      return service.parseAmount(amount);
    } catch (error) {
      logger.error(`Failed to parse ${token} amount:`, error);
      throw error;
    }
  }

  /**
   * Validate amount
   */
  static isValidAmount(amount: string, token: SupportedToken): boolean {
    try {
      const service = this.getTokenService(token);
      return service.isValidAmount(amount);
    } catch (error) {
      logger.error(`Failed to validate ${token} amount:`, error);
      return false;
    }
  }

  /**
   * Check if token can be minted (only cNGN)
   */
  static canMint(token: SupportedToken): boolean {
    return token.toUpperCase() === "CNGN";
  }

  /**
   * Mint tokens (only for cNGN)
   */
  static async mintToUser(
    userAddress: string,
    amount: string,
    token: SupportedToken
  ): Promise<ContractCallResult> {
    if (!this.canMint(token)) {
      return {
        success: false,
        error: `${token} cannot be minted. Use faucet or other sources.`,
      };
    }

    try {
      return await CngnService.mintToUser(userAddress, amount);
    } catch (error) {
      logger.error(`Failed to mint ${token}:`, error);
      throw error;
    }
  }

  /**
   * Get all supported tokens
   */
  static getSupportedTokens(): SupportedToken[] {
    return ["cNGN", "USDC"];
  }

  /**
   * Check if token is supported
   */
  static isSupported(token: string): token is SupportedToken {
    return this.getSupportedTokens().includes(
      token.toUpperCase() as SupportedToken
    );
  }

  /**
   * Get token address
   */
  static getTokenAddress(token: SupportedToken): string {
    const config = this.getTokenConfig(token);
    return config.address;
  }

  /**
   * Get token decimals
   */
  static getTokenDecimals(token: SupportedToken): number {
    const config = this.getTokenConfig(token);
    return config.decimals;
  }
}
