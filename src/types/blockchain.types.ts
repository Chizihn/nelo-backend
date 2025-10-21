export interface WalletInfo {
  address: string;
  privateKey: string;
  publicKey: string;
}

export interface TransactionRequest {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: number;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface TransactionReceipt {
  hash: string;
  blockNumber: number;
  blockHash: string;
  gasUsed: string;
  status: number;
  from: string;
  to: string;
  logs: any[];
}

export interface ContractCallResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  txHash?: string;
  gasUsed?: string;
}

export interface TokenBalance {
  balance: string;
  decimals: number;
  symbol: string;
  name: string;
}

export interface BasenameInfo {
  name: string;
  address: string;
  isValid: boolean;
  expiresAt?: Date;
}

export interface BlockchainEvent {
  event: string;
  args: any[];
  blockNumber: number;
  transactionHash: string;
  address: string;
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  estimatedCost: string;
}
