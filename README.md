# Virtual Card Backend & WhatsApp Bot

A comprehensive backend system for managing virtual cards on Base blockchain with WhatsApp bot integration using cNGN (from cngn.co) stablecoin.

## 🚀 Features

- **WhatsApp Bot Integration**: Complete bot using Meta's WhatsApp Cloud API
- **Virtual Card Management**: Create, manage, and use virtual cards as NFTs
- **Base Blockchain Integration**: Built for Base Sepolia testnet
- **cNGN Token Support**: Full integration with cNGN stablecoin from cngn.co
- **Basename Support**: Base's ENS integration for user-friendly addresses
- **Secure Wallet Management**: Encrypted private key storage
- **Transaction Monitoring**: Real-time blockchain transaction tracking
- **RESTful API**: Complete REST API for frontend integration

## 🛠 Tech Stack

- **Backend**: Node.js, TypeScript, Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Blockchain**: Ethers.js v6, Base Sepolia
- **WhatsApp**: Meta WhatsApp Cloud API
- **Caching**: Redis for sessions and queues
- **Security**: JWT, bcrypt, helmet
- **Logging**: Winston

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL database
- Redis server
- Meta WhatsApp Business Account
- Base Sepolia testnet access

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
   DATABASE_URL=postgresql://user:password@localhost:5432/virtualcard

   # Meta WhatsApp Cloud API
   WHATSAPP_ACCESS_TOKEN=your_access_token
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
   WHATSAPP_APP_SECRET=your_app_secret

   # Base Blockchain
   BASE_RPC_URL=https://sepolia.base.org
   VIRTUAL_CARD_CONTRACT_ADDRESS=0x... # Your deployed contract
   CNMG_TOKEN_ADDRESS=0x... # cNGN token address
   DEPLOYER_PRIVATE_KEY=0x... # Your deployer private key

   # Security
   JWT_SECRET=your_jwt_secret_here_make_it_long_and_secure
   ENCRYPTION_KEY=your_32_character_encryption_key_here

   # Redis
   REDIS_URL=redis://localhost:6379
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
   - `create card` - Create a virtual card
   - `balance` - Check your balance
   - `send 10 to 0x...` - Send cNGN

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

Users can interact with the bot using these commands:

- **`help`** - Show available commands
- **`create card`** - Create a new virtual card
- **`balance`** - Check total cNGN balance
- **`my cards`** - List all virtual cards
- **`send [amount] to [address/basename]`** - Transfer cNGN
  - Example: `send 100 to alice.basetest.eth`
  - Example: `send 50 to 0x1234...`
- **`deposit`** - Get deposit information
- **`history`** - View recent transactions
- **`profile`** - View user profile

## 🔐 Security Features

- **Encrypted Private Keys**: All private keys encrypted with AES-256-GCM
- **Webhook Verification**: Meta signature verification
- **Rate Limiting**: API rate limiting protection
- **JWT Authentication**: Secure API access
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Configurable CORS policies

## 🏗 Architecture

```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── services/        # Business logic
│   ├── blockchain/  # Blockchain interactions
│   ├── whatsapp/    # WhatsApp bot logic
│   ├── card/        # Card management
│   └── user/        # User management
├── routes/          # API routes
├── middleware/      # Express middleware
├── types/           # TypeScript types
└── utils/           # Utility functions
```

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

## 🔗 Links

- [Base Documentation](https://docs.base.org)
- [cNGN Documentation](https://cngn.co)
- [Meta WhatsApp API](https://developers.facebook.com/docs/whatsapp)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)

---

Built with ❤️ for Base Batches Hackathon
# nelo-backend
