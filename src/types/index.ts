export * from "./whatsapp.types";
export * from "./blockchain.types";
export * from "./card.types";

// Common types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  code?: string;
  details?: any;
}
