import { ethers } from "ethers";
import {
  CONTRACT_ADDRESSES,
  CONTRACT_ABIS,
  provider,
} from "@/config/blockchain";
import { BasenameInfo } from "@/types/blockchain.types";
import { logger } from "@/utils/logger";
import { REGEX_PATTERNS } from "@/utils/constants";

export class BasenameService {
  private static getResolver() {
    if (!CONTRACT_ADDRESSES.L2_RESOLVER) {
      throw new Error("L2 Resolver contract address not configured");
    }

    return new ethers.Contract(
      CONTRACT_ADDRESSES.L2_RESOLVER,
      CONTRACT_ABIS.L2_RESOLVER,
      provider
    );
  }

  /**
   * Resolve basename to address
   */
  static async resolveBasename(basename: string): Promise<BasenameInfo> {
    try {
      if (!this.isValidBasename(basename)) {
        return {
          name: basename,
          address: "",
          isValid: false,
        };
      }

      const resolver = this.getResolver();

      // Convert basename to namehash
      const node = ethers.namehash(basename);
      const address = await resolver.addr(node); // Updated to use correct ENS function

      // Check if address is valid (not zero address)
      const isValid = address !== ethers.ZeroAddress;

      return {
        name: basename,
        address: isValid ? address : "",
        isValid,
      };
    } catch (error) {
      logger.error("Failed to resolve basename:", error);
      return {
        name: basename,
        address: "",
        isValid: false,
      };
    }
  }

  /**
   * Reverse resolve address to basename
   * Note: ENS reverse resolution requires a reverse registrar
   */
  static async reverseResolve(address: string): Promise<string | null> {
    try {
      if (!ethers.isAddress(address)) {
        return null;
      }

      // For ENS reverse resolution, we need to:
      // 1. Create reverse node: keccak256(address.toLowerCase().slice(2) + '.addr.reverse')
      // 2. Query the resolver for that node
      const reverseNode = ethers.namehash(
        `${address.toLowerCase().slice(2)}.addr.reverse`
      );
      const resolver = this.getResolver();

      const basename = await resolver.name(reverseNode); // Updated to use ENS name() function

      // Verify the basename resolves back to the same address
      if (basename) {
        const resolved = await this.resolveBasename(basename);
        if (
          resolved.isValid &&
          resolved.address.toLowerCase() === address.toLowerCase()
        ) {
          return basename;
        }
      }

      return null;
    } catch (error) {
      logger.error("Failed to reverse resolve address:", error);
      return null;
    }
  }

  /**
   * Check if basename format is valid
   */
  static isValidBasename(basename: string): boolean {
    return REGEX_PATTERNS.BASENAME.test(basename);
  }

  /**
   * Check if basename is available/registered
   */
  static async isBasenameRegistered(basename: string): Promise<boolean> {
    try {
      const resolved = await this.resolveBasename(basename);
      return resolved.isValid;
    } catch (error) {
      logger.error("Failed to check basename registration:", error);
      return false;
    }
  }

  /**
   * Get basename info with additional metadata
   */
  static async getBasenameInfo(basename: string): Promise<
    BasenameInfo & {
      owner?: string;
      registrationDate?: Date;
    }
  > {
    try {
      const resolved = await this.resolveBasename(basename);

      if (!resolved.isValid) {
        return resolved;
      }

      // Additional info can be fetched from registry contract if available
      return {
        ...resolved,
        owner: resolved.address,
      };
    } catch (error) {
      logger.error("Failed to get basename info:", error);
      return {
        name: basename,
        address: "",
        isValid: false,
      };
    }
  }

  /**
   * Suggest available basenames
   */
  static generateBasenameVariations(desiredName: string): string[] {
    const variations: string[] = [];
    const cleanName = desiredName.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Basic variations
    variations.push(`${cleanName}.basetest.eth`);
    variations.push(`${cleanName}1.basetest.eth`);
    variations.push(`${cleanName}2.basetest.eth`);
    variations.push(`${cleanName}3.basetest.eth`);

    // With prefixes
    variations.push(`my${cleanName}.basetest.eth`);
    variations.push(`the${cleanName}.basetest.eth`);

    // With suffixes
    variations.push(`${cleanName}x.basetest.eth`);
    variations.push(`${cleanName}z.basetest.eth`);

    return variations.slice(0, 8); // Return top 8 suggestions
  }

  /**
   * Check multiple basenames availability
   */
  static async checkMultipleBasenames(basenames: string[]): Promise<
    Array<{
      name: string;
      available: boolean;
      address?: string;
    }>
  > {
    try {
      const results = await Promise.all(
        basenames.map(async (basename) => {
          const info = await this.resolveBasename(basename);
          return {
            name: basename,
            available: !info.isValid,
            address: info.address || undefined,
          };
        })
      );

      return results;
    } catch (error) {
      logger.error("Failed to check multiple basenames:", error);
      return basenames.map((name) => ({ name, available: false }));
    }
  }

  /**
   * Format basename for display
   */
  static formatBasename(basename: string): string {
    if (!basename) return "";

    // Ensure it has the correct suffix
    if (!basename.endsWith(".basetest.eth")) {
      return `${basename}.basetest.eth`;
    }

    return basename;
  }

  /**
   * Extract basename from full name
   */
  static extractBasename(fullName: string): string {
    if (fullName.endsWith(".basetest.eth")) {
      return fullName.replace(".basetest.eth", "");
    }
    return fullName;
  }
}
