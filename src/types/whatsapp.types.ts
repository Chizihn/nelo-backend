export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: "text" | "image" | "audio" | "video" | "document";
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface WhatsAppOutgoingMessage {
  messaging_product: "whatsapp";
  to: string;
  type: "text" | "template" | "interactive";
  text?: {
    body: string;
    preview_url?: boolean;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: any[];
  };
  interactive?: {
    type: "button" | "list";
    body: {
      text: string;
    };
    action: any;
  };
}

export interface UserSession {
  userId: string;
  whatsappNumber: string;
  // Flow control
  currentFlow?: string;
  flowStep?: number;
  flowData?: any;
  // Activity tracking
  lastActivity: Date;
  messageCount: number;
  lastInput?: string;
  lastMessageId?: string;
  expiresAt: number;

  // Transaction / PIN state
  awaitingPin?: boolean;
  awaitingSecurityAnswer?: boolean;
  pendingTransaction?: any;

  // Card selection properties
  awaitingCardSelection?: boolean;
  cardSelectionType?: "VIEW" | "FUND" | "MANAGE";
  availableCards?: any[];

  // Welcome message tracking
  isFirstMessage?: boolean;
}

export interface BotCommand {
  command: string;
  aliases: string[];
  description: string;
  handler: string;
  requiresAuth: boolean;
}

export interface MessageContext {
  message: WhatsAppMessage;
  user?: {
    id: string;
    whatsappNumber: string;
    walletAddress: string;
    basename?: string;
  };
  session: UserSession;
  contact?: {
    name: string;
    wa_id: string;
  };
}
