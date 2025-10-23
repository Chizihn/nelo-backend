import {
  VirtualCardStatus,
  TransactionType,
  TransactionStatus,
} from "@prisma/client";

export interface CreateCardRequest {
  userId: string;
}

export interface CardInfo {
  id: string;
  cardNumber: string;
  tokenId: string;
  balance: string;
  cNGNBalance: string;
  status: VirtualCardStatus;
  lastUsedAt?: Date;
  createdAt: Date;
}

export interface DepositRequest {
  cardId: string;
  amount: string;
  fromAddress?: string;
}

export interface PaymentRequest {
  cardId: string;
  amount: string;
  recipient: string;
  description?: string;
}

export interface TransferRequest {
  fromAddress: string;
  toAddress: string;
  amount: string;
  description?: string;
}

export interface TransactionInfo {
  id: string;
  type: TransactionType;
  amount: string;
  currency: string;
  status: TransactionStatus;
  txHash?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnRampRequest {
  userId: string;
  amount: string;
  currency: string;
  returnUrl?: string;
}

export interface OffRampRequest {
  userId: string;
  amount: string;
  bankAccount?: {
    accountNumber: string;
    bankCode: string;
    accountName: string;
  };
}

export interface CardBalance {
  cardId: string;
  cNGNBalance: string;
  lastSyncAt: Date;
}
