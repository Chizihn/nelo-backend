# Nelo - Dual Token Virtual Card Backend & WhatsApp Bot

A production-ready fintech backend for Nigerian users to buy **cNGN & USDC** via WhatsApp and use them with virtual cards. Built on Base blockchain with Nelo custody contract integration supporting multiple tokens.

## 🚀 Features

- **WhatsApp Bot Integration**: Complete conversational bot using Meta's WhatsApp Cloud API
- **Dual Token Support**: Both cNGN (mintable) and USDC (real token) support
- **cNGN Onramp/Offramp**: Buy cNGN with NGN via Flutterwave → Official cNGN API integration
- **USDC Integration**: Real USDC from faucet.circle.com → Nelo custody
- **Nelo Custody Contract**: Secure on-chain custody supporting ANY whitelisted ERC20 token
- **Virtual Card Management**: Create and manage virtual cards funded with cNGN or USDC
- **Base Blockchain Integration**: Built for Base Sepolia (testnet) and Base mainnet
- **Basename Support**: Human-readable addresses (alice.base.eth)
- **Secure Architecture**: No deployer keys in production, proper role separation
- **Real-time Notifications**: WhatsApp notifications for all transactions

## 🛠 Tech Stack

- **Backend**: Node.js, TypeScript, Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Blockchain**: Ethers.js v6, Base Sepolia/Mainnet
- **Smart Contracts**: Nelo custody contract, cNGN ERC20 token, USDC ERC20 token
- **Payment**: Flutterwave (NGN) → cNGN API (minting) OR USDC (faucet) → Nelo custody
- **WhatsApp**: Meta WhatsApp Cloud API with conversational flows
- **Security**: Encrypted private keys, operator roles, webhook verification
- **Logging**: Winston with structured logging

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL database
- Meta WhatsApp Business Account
- Base Sepolia ETH for gas (from faucet)
- cNGN API access (from cNGN team)
- Flutterwave merchant account (for NGN payments)
- Deployed Nelo custody contract

## ⚙️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd virtual-card-backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup**

   ```bash
   cp .env.example .env
   ```

   Fill in your environment variables:

   ```env
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/nelo

   # Meta WhatsApp Cloud API
   WHATSAPP_ACCESS_TOKEN=your_access_token
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
   WHATSAPP_APP_SECRET=your_app_secret

   # Base Blockchain (Sepolia Testnet)
   BASE_RPC_URL=https://sepolia.base.org
   BASE_CHAIN_ID=84532
   NELO_CUSTODY_CONTRACT_ADDRESS=0x... # Deployed Nelo contract
   CNGN_TOKEN_ADDRESS=0x... # cNGN token on Base
   USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e # Real USDC on Base Sepolia
   L2_RESOLVER_ADDRESS=0xC6d566A56A1aFf6508b41f6c90ff131615583BCD

   # Security - Separate Keys for Different Roles
   OPERATOR_PRIVATE_KEY=0x... # Operator wallet (OPERATOR_ROLE in Nelo)
   FEE_COLLECTOR_ADDRESS=0x... # Business wallet (multisig recommended)

   # cNGN API Integration
   CNGN_API_KEY=sk_test_XXXXXXXX
   CNGN_WEBHOOK_SECRET=whsec_XXXXXXXX
   CNGN_API_URL=https://api.cngn.co/v1

   # Flutterwave Integration
   FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-XXXXXXXX
   FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-XXXXXXXX
   FLUTTERWAVE_WEBHOOK_SECRET=your_webhook_secret

   # Security
   JWT_SECRET=your_jwt_secret_here_make_it_long_and_secure
   ENCRYPTION_KEY=your_32_character_encryption_key_here
   ```

4. **Database Setup**

   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## 📱 WhatsApp Bot Setup

### Step 1: Create Meta Developer Account

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app → Business type
3. Add WhatsApp product to your app

### Step 2: Get Credentials

From your WhatsApp Business API setup:

- **Access Token**: Temporary token for testing
- **Phone Number ID**: Your test phone number ID
- **App Secret**: From App Settings → Basic
- **Webhook Verify Token**: Create a secure random string

### Step 3: Configure Webhook

1. In WhatsApp → Configuration:

   - **Webhook URL**: `https://your-domain.com/webhook/whatsapp`
   - **Verify Token**: Your `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
   - Subscribe to `messages` field

2. Test webhook verification:
   ```bash
   curl -X GET "https://your-domain.com/webhook/whatsapp?hub.mode=subscribe&hub.challenge=test&hub.verify_token=your_token"
   ```

### Step 4: Test the Bot

1. Send a message to your WhatsApp test number
2. Try these commands:
   - `help` - Show available commands
   - `buy 10000` - Buy 10,000 cNGN with NGN
   - `paid 10000` - Confirm NGN payment (triggers cNGN minting)
   - `balance` - Check your cNGN balance
   - `create card` - Create a virtual card
   - `send 1000 to alice.base.eth` - Send cNGN

## 🪙 Dual Token Support

Nelo supports **both cNGN and USDC** in the same wallet and custody system:

### cNGN (Nigerian Naira Token)

- **Address**: `0xB391cb3C9B33261890C7c35DfC7b999B46f9Ace6` (Base Sepolia)
- **Decimals**: 6
- **Mintable**: ✅ Yes (via backend API)
- **Onramp**: Pay NGN → Backend mints cNGN → Deposit to Nelo
- **Commands**: `buy cngn`, `buy 10000`, `send 1000 cngn to alice.base.eth`

### USDC (USD Coin)

- **Address**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Base Sepolia)
- **Decimals**: 6
- **Mintable**: ❌ No (real token)
- **Onramp**: Pay NGN → User gets USDC from faucet → Deposit to Nelo
- **Commands**: `buy usdc`, `send 10 usdc to bob.base.eth`

### Shared Features

- **Same Custody Contract**: Both tokens use the same Nelo contract
- **Same Commands**: `balance`, `send`, `deposit` work for both
- **Same Offramp**: Both can be withdrawn to NGN via Flutterwave
- **Same Security**: Same PIN, KYC, and security model

### WhatsApp Commands

```bash
# Check both balances
balance

# Buy tokens
buy cngn          # Buy cNGN with NGN
buy usdc          # Get USDC from faucet
buy 10000         # Buy 10,000 cNGN (default)

# Send tokens
send 1000 cngn to alice.base.eth    # Send cNGN
send 10 usdc to bob.base.eth        # Send USDC
send 500 to alice.base.eth          # Send cNGN (default)

# Deposit address (works for both)
deposit           # Shows wallet address for both tokens
```

## 🔧 API Endpoints

### Webhook

- `GET /webhook/whatsapp` - Webhook verification
- `POST /webhook/whatsapp` - Handle incoming messages

### Users

- `POST /api/users` - Create user
- `GET /api/users/:userId` - Get user details
- `PATCH /api/users/:userId/basename` - Update basename

### Cards

- `POST /api/cards` - Create virtual card
- `GET /api/cards/user/:userId` - Get user's cards
- `POST /api/cards/:cardId/deposit` - Deposit to card
- `POST /api/cards/:cardId/payment` - Process payment

### Transactions

- `GET /api/transactions/user/:userId` - Get user transactions
- `GET /api/transactions/:transactionId` - Get transaction details

## 🤖 WhatsApp Bot Commands

### 💰 Buy & Manage Crypto

- **`buy 10000`** - Buy 10,000 cNGN with NGN (via Flutterwave)
- **`buy cngn`** - Buy cNGN with NGN
- **`buy usdc`** - Get USDC from faucet (instructions)
- **`paid 10000`** - Confirm NGN payment (triggers cNGN minting)
- **`balance`** - Check your cNGN and USDC balances
- **`sell 5000`** - Sell 5,000 cNGN for NGN (to bank account)

### 💳 Virtual Cards

- **`create card`** - Create a new virtual card
- **`my cards`** - List all your virtual cards
- **`fund card 5000`** - Add 5,000 cNGN to a card

### 💸 Send Money

- **`send 1000 cngn to alice.base.eth`** - Send cNGN to Basename
- **`send 10 usdc to bob.base.eth`** - Send USDC to Basename
- **`send 500 to alice.base.eth`** - Send cNGN (default) to Basename
- **`send 100 to 0x1234...`** - Send to wallet address

### 🏦 Bank Accounts

- **`add bank`** - Add your Nigerian bank account
- **`my banks`** - View saved bank accounts

### 📊 Account Management

- **`history`** - View recent transactions
- **`profile`** - View your profile
- **`set basename alice.base.eth`** - Set your Basename
- **`help`** - Show all commands

### 🔄 Complete Flow Example

```
User: "buy 10000"
Bot: "Transfer ₦10,000 to Account: 1234567890..."

User: "paid 10000"
Bot: "✅ Payment confirmed! 10,000 cNGN minted to your wallet"

User: "buy usdc"
Bot: "Visit faucet.circle.com to get USDC..."

User: "balance"
Bot: "💰 Your Portfolio
🇳🇬 cNGN: 10,000 (₦10,000)
💵 USDC: 50 ($50)"

User: "send 1000 cngn to bob.base.eth"
Bot: "✅ Sent 1,000 cNGN to bob.base.eth"

User: "send 5 usdc to alice.base.eth"
Bot: "✅ Sent 5 USDC to alice.base.eth"
```

## 🔐 Security Features

- **Encrypted Private Keys**: All private keys encrypted with AES-256-GCM
- **Webhook Verification**: Meta signature verification
- **Rate Limiting**: API rate limiting protection
- **JWT Authentication**: Secure API access
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Configurable CORS policies

## 🏗 Architecture

### Payment Flow

```
NGN Payment (Flutterwave) → cNGN API (Mint) → Nelo Custody → Virtual Cards
```

### Project Structure

```
src/
├── config/
│   ├── blockchain.ts        # Base network, contracts, operator wallet
│   ├── whatsapp.ts         # WhatsApp templates and responses
│   └── env.ts              # Environment validation
├── services/
│   ├── blockchain/
│   │   ├── cngnService.ts          # cNGN token interactions
│   │   ├── cngnOnrampService.ts    # cNGN API integration
│   │   ├── neloContractService.ts  # Nelo custody operations
│   │   └── walletService.ts        # Wallet management
│   ├── whatsapp/
│   │   ├── messageHandler.ts       # Command processing
│   │   ├── intentParser.ts         # Natural language parsing
│   │   └── whatsappService.ts      # WhatsApp API client
│   ├── payment/
│   │   ├── mockFiatService.ts      # NGN→cNGN flow
│   │   ├── flutterwaveService.ts   # NGN payment processing
│   │   └── offRampService.ts       # cNGN→NGN withdrawal
│   └── card/
│       └── cardService.ts          # Virtual card management
├── routes/
│   ├── webhook.routes.ts           # WhatsApp webhooks
│   ├── stablesrail.routes.ts       # cNGN API webhooks
│   └── payment.routes.ts           # Payment endpoints
└── types/                          # TypeScript definitions
```

### Security Architecture

- **Operator Wallet**: Only has OPERATOR_ROLE in Nelo contract
- **User Wallets**: Control their own deposits/withdrawals
- **No Deployer Keys**: Backend never holds large token balances
- **Webhook Verification**: All webhooks cryptographically verified

## ✅ What's Been Fixed & Implemented

### 🔒 Security Fixes

- ✅ **Removed deployer key usage** - No more "insufficient deployer balance" errors
- ✅ **Proper role separation** - Operator vs Admin vs User roles
- ✅ **cNGN API integration** - Official minting via cNGN issuer
- ✅ **Secure custody flow** - Users control deposits, operators manage custodial transfers

### 🏗️ Architecture Cleanup

- ✅ **Deleted redundant services** - Removed duplicate onRamp/offRamp implementations
- ✅ **Focused on cNGN only** - Removed USDC/USDT to simplify UX
- ✅ **Fixed WhatsApp integration** - All commands work with proper service calls
- ✅ **Updated database schema** - Added onrampRequest tracking

### 🔄 Working Payment Flow

```
1. User: "buy 10000" → Flutterwave payment instructions
2. User pays NGN → Flutterwave webhook → Backend
3. Backend → cNGN API → Mint cNGN directly to user wallet
4. User: "create card" → Virtual card funded with cNGN
5. User: "send 1000 to alice.base.eth" → Transfer via Nelo custody
```

### 🚀 Ready for Production

- ✅ **Nelo contract integration** - Secure custody with operator transfers
- ✅ **WhatsApp bot** - Complete conversational interface
- ✅ **cNGN onramp** - NGN → cNGN via official API
- ✅ **Virtual cards** - Create and manage cards with cNGN
- ✅ **Bank integration** - Withdraw cNGN to Nigerian bank accounts

## 🚀 Deployment

### Railway/Render Deployment

1. **Prepare for deployment**

   ```bash
   npm run build
   ```

2. **Set environment variables** in your hosting platform

3. **Database migration**

   ```bash
   npm run db:migrate
   ```

4. **Start production server**
   ```bash
   npm start
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Test WhatsApp webhook
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[...]}'
```

## 📊 Monitoring

- **Health Check**: `GET /health`
- **Logs**: Winston logging to files and console
- **Metrics**: Transaction statistics via API
- **Error Tracking**: Comprehensive error handling

## 🔧 Development

```bash
# Start development server
npm run dev

# Generate Prisma client
npm run db:generate

# Reset database
npm run db:push

# View database
npx prisma studio
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the documentation
- Review the logs for debugging

## 🚨 Production Checklist

### Before Going Live:

- [ ] Deploy Nelo custody contract on Base mainnet
- [ ] Get production cNGN API keys from cNGN team
- [ ] Set up Flutterwave production merchant account
- [ ] Configure multisig wallet for FEE_COLLECTOR_ADDRESS
- [ ] Set up proper monitoring and alerting
- [ ] Implement rate limiting and DDoS protection
- [ ] Set up backup systems for database and keys
- [ ] Complete security audit of smart contracts
- [ ] Test with small amounts first

### Environment Changes for Production:

```env
BASE_RPC_URL=https://mainnet.base.org
BASE_CHAIN_ID=8453
CNGN_API_URL=https://api.cngn.co/v1  # Production URL
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-XXXXXXXX  # Production keys
```

## 🔗 Links

- [Base Documentation](https://docs.base.org)
- [cNGN Documentation](https://docs.cngn.co)
- [Nelo Contract Explanation](./explanation.txt)
- [Meta WhatsApp API](https://developers.facebook.com/docs/whatsapp)
- [Flutterwave API](https://developer.flutterwave.com/docs)
- [Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)

---

**Nelo** - Making cNGN accessible to every Nigerian via WhatsApp 🇳🇬  
Built with ❤️ on Base blockchain
