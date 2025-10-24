//src/config/blockchain.ts
import { ethers } from "ethers";
import { config } from "dotenv";
config(); // Load .env file

// Environment variable validation
const env = {
  BASE_RPC_URL: process.env.BASE_RPC_URL,
  DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY,
  NELO_CUSTODY_CONTRACT_ADDRESS: process.env.NELO_CUSTODY_CONTRACT_ADDRESS,
  CNGN_TOKEN_ADDRESS: process.env.CNGN_TOKEN_ADDRESS,
  USDC_TOKEN_ADDRESS: process.env.USDC_TOKEN_ADDRESS,
  L2_RESOLVER_ADDRESS: process.env.L2_RESOLVER_ADDRESS,
  BASE_CHAIN_ID: process.env.BASE_CHAIN_ID,
};

// Validate environment variables
if (!env.BASE_RPC_URL) throw new Error("BASE_RPC_URL is not set");
if (!env.DEPLOYER_PRIVATE_KEY)
  throw new Error("DEPLOYER_PRIVATE_KEY is not set");
if (!env.NELO_CUSTODY_CONTRACT_ADDRESS)
  throw new Error("NELO_CUSTODY_CONTRACT_ADDRESS is not set");
if (!env.CNGN_TOKEN_ADDRESS) throw new Error("CNGN_TOKEN_ADDRESS is not set");
if (!env.USDC_TOKEN_ADDRESS) throw new Error("USDC_TOKEN_ADDRESS is not set");
if (!env.L2_RESOLVER_ADDRESS) throw new Error("L2_RESOLVER_ADDRESS is not set");
if (!env.DEPLOYER_PRIVATE_KEY)
  throw new Error("DEPLOYER_PRIVATE_KEY is not set");
if (env.L2_RESOLVER_ADDRESS !== "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD") {
  console.warn(
    "L2_RESOLVER_ADDRESS should be 0xC6d566A56A1aFf6508b41f6c90ff131615583BCD for Basename on Base Sepolia"
  );
}
if (env.BASE_CHAIN_ID !== "84532")
  throw new Error("BASE_CHAIN_ID must be 84532 for Base Sepolia");

// Base Sepolia Provider with fallback (Edge Case #5)
const primaryProvider = new ethers.JsonRpcProvider(env.BASE_RPC_URL);
const fallbackProvider = new ethers.JsonRpcProvider(
  "https://sepolia.base.org" // Public RPC fallback
);

export const provider = new ethers.FallbackProvider([
  { provider: primaryProvider, weight: 1 },
  { provider: fallbackProvider, weight: 1 },
]);

// Deployer wallet
export const deployerWallet = new ethers.Wallet(
  env.DEPLOYER_PRIVATE_KEY,
  provider
);

// Contract addresses
export const CONTRACT_ADDRESSES = {
  NELO_CUSTODY: env.NELO_CUSTODY_CONTRACT_ADDRESS,
  CNGN_TOKEN: env.CNGN_TOKEN_ADDRESS,
  USDC_TOKEN: env.USDC_TOKEN_ADDRESS,
  L2_RESOLVER: env.L2_RESOLVER_ADDRESS,
} as const;

// Supported tokens configuration
export const SUPPORTED_TOKENS = {
  cNGN: {
    address: env.CNGN_TOKEN_ADDRESS,
    decimals: 6, // FIXED: Your cNGN has 6 decimals, not 18!
    symbol: "cNGN",
    name: "Nigerian Naira Token",
    deployed: true,
    network: "Base Sepolia",
  },
  USDC: {
    address: env.USDC_TOKEN_ADDRESS,
    decimals: 6, // USDC has 6 decimals
    symbol: "USDC",
    name: "USD Coin",
    deployed: true,
    network: "Base Sepolia",
  },
} as const;

// Chain configuration
export const CHAIN_CONFIG = {
  chainId: env.BASE_CHAIN_ID,
  name: "Base Sepolia",
  rpcUrl: env.BASE_RPC_URL,
  blockExplorer: "https://sepolia.basescan.org",
} as const;

// Contract ABIs
export const CONTRACT_ABIS = {
  NELO_CUSTODY: [
    "function deposit(address token, uint256 amount) external",
    "function depositWithPermit(address token, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
    "function withdraw(address token, uint256 amount, address to) external",
    "function balanceOf(address user, address token) external view returns (uint256)",
    "function transferToCustodian(address user, address token, uint256 amount, address custodian) external",
    "function tokenWhitelisted(address token) external view returns (bool)",
    "function batchBalances(address[] calldata users, address[] calldata tokens) external view returns (uint256[] memory)",
    "event Deposited(address indexed user, address indexed token, uint256 amount)",
    "event Withdrawn(address indexed user, address indexed token, uint256 amount, address indexed to)",
    "event TransferToCustodian(address indexed user, address indexed token, uint256 amount, address indexed custodian)",
    "event TokenWhitelisted(address indexed token, bool indexed allowed)",
  ],

  CNGN_TOKEN: [
    "function balanceOf(address account) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
    "function name() external view returns (string)",
    "function mint(address to, uint256 amount) external",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
  ],

  // Standard ERC20 ABI for USDC (no mint function)
  USDC_TOKEN: [
    "function balanceOf(address account) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
    "function name() external view returns (string)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
  ],
  L2_RESOLVER: [
    // Address resolution
    "function addr(bytes32 node) external view returns (address)",
    "function addr(bytes32 node, uint256 coinType) external view returns (bytes memory)",

    // Reverse resolution
    "function name(bytes32 node) external view returns (string memory)",

    // Text records
    "function text(bytes32 node, string calldata key) external view returns (string memory)",

    // Setters (require authorization)
    "function setAddr(bytes32 node, address a) external",
    "function setAddr(bytes32 node, uint256 coinType, bytes memory a) external",
    "function setText(bytes32 node, string calldata key, string calldata value) external",
    "function setName(bytes32 node, string calldata newName) external",

    // Content hash
    "function contenthash(bytes32 node) external view returns (bytes memory)",
    "function setContenthash(bytes32 node, bytes calldata hash) external",

    // ABI storage
    "function ABI(bytes32 node, uint256 contentTypes) external view returns (uint256, bytes memory)",
    "function setABI(bytes32 node, uint256 contentType, bytes calldata data) external",

    // Public key
    "function pubkey(bytes32 node) external view returns (bytes32 x, bytes32 y)",
    "function setPubkey(bytes32 node, bytes32 x, bytes32 y) external",

    // Interface support
    "function supportsInterface(bytes4 interfaceID) external pure returns (bool)",

    // Events
    "event AddrChanged(bytes32 indexed node, address a)",
    "event AddressChanged(bytes32 indexed node, uint256 coinType, bytes newAddress)",
    "event TextChanged(bytes32 indexed node, string indexed indexedKey, string key, string value)",
    "event NameChanged(bytes32 indexed node, string name)",
    "event ContenthashChanged(bytes32 indexed node, bytes hash)",
    "event ABIChanged(bytes32 indexed node, uint256 indexed contentType)",
  ],
} as const;

// Gas settings
export const GAS_SETTINGS = {
  gasLimit: 500000,
  maxFeePerGas: ethers.parseUnits("2", "gwei"),
  maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
} as const;
