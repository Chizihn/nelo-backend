// Mock Privy types for development
declare module "@privy-io/server-auth" {
  export interface PrivyApiConfig {
    appId: string;
    appSecret: string;
  }

  export class PrivyApi {
    constructor(config: PrivyApiConfig);

    createUser(params: {
      linkedAccounts: Array<{
        type: string;
        phoneNumber: string;
      }>;
      createEmbeddedWallet: boolean;
    }): Promise<any>;

    getUsers(params: {
      linkedAccounts: Array<{
        type: string;
        phoneNumber: string;
      }>;
    }): Promise<any[]>;

    signTransaction(userId: string, transaction: any): Promise<string>;
  }
}
