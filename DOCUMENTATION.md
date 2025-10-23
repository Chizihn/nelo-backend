# 📱 Nelo - Complete Documentation

## 🌟 **Overview**

Nelo is a revolutionary WhatsApp-based digital payment system that enables Nigerians to create and manage virtual debit cards using cNGN (a regulated stablecoin pegged 1:1 to the Nigerian Naira) on the Base blockchain. Users can perform all banking operations through simple WhatsApp messages.

### **🎯 Mission**

To democratize digital payments in Nigeria by making blockchain-based financial services accessible through WhatsApp - the most popular messaging platform in Nigeria.

### **⚡ Key Features**

- 📱 **WhatsApp Interface** - No app downloads required
- 💳 **Instant Virtual Cards** - Create cards in seconds
- 🔒 **Blockchain Security** - Built on Base (Ethereum L2)
- 💰 **cNGN Integration** - Use regulated Naira-pegged stablecoin
- 🏦 **Full Banking** - Deposit, withdraw, transfer, pay
- 🌐 **ENS Basenames** - Human-readable wallet addresses
- 📊 **Real-time Tracking** - Instant transaction updates

---

## 🏗️ **System Architecture**

### **High-Level Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WhatsApp      │    │   Nelo Backend  │    │   Base Blockchain│
│   (User Interface)│◄──►│   (API Server)  │◄──►│   (Smart Contracts)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │   (Database)    │
                       └─────────────────┘
```

### **Core Components**

#### **1. WhatsApp Bot Interface**

- **Purpose**: User interaction layer
- **Technology**: Meta WhatsApp Cloud API
- **Features**: Natural language processing, command handling, message formatting
- **Security**: Webhook verification, rate limiting

#### **2. Backend API Server**

- **Purpose**: Business logic and orchestration
- **Technology**: Node.js, Express, TypeScript
- **Features**: User management, card operations, transaction processing
- **Security**: JWT authentication, input validation, encryption

#### **3. Blockchain Layer**

- **Purpose**: Decentralized finance operations
- **Technology**: Base (Ethereum L2), Ethers.js
- **Features**: Smart contract interactions, wallet management, transaction signing
- **Security**: Private key encryption, gas optimization

#### **4. Database Layer**

- **Purpose**: Data persistence and user state
- **Technology**: PostgreSQL with Prisma ORM
- **Features**: User profiles, card records, transaction history
- **Security**: Encrypted sensitive data, connection pooling

---

## 👥 **Target Users**

### **Primary Users**

- **Nigerian Millennials & Gen Z**
- **Small Business Owners** seeking digital payment solutions
- **Freelancers** needing international payment capabilities
- **Students** requiring easy money management
- **Crypto Enthusiasts** wanting mainstream DeFi access

### **User Personas**

#### **🎓 Student - Ada (22)**

- **Needs**: Easy money management, low fees, parental transfers
- **Usage**: Receives money from parents, pays for food/transport
- **Pain Points**: High bank fees, complex banking apps

#### **🛍️ Small Business Owner - Emeka (28)**

- **Needs**: Accept digital payments, manage cash flow
- **Usage**: Receives payments from customers, pays suppliers
- **Pain Points**: Cash-only economy, payment delays

#### **💻 Freelancer - Kemi (25)**

- **Needs**: International payments, currency conversion
- **Usage**: Receives payments from global clients, local expenses
- **Pain Points**: High forex fees, payment restrictions

---

## 🔧 **How It Works**

### **User Journey Flow**

#### **1. Onboarding (First Time)**

```
User → "Hi" → Bot → Welcome Message → Account Creation → Wallet Generation → Ready!
```

**Detailed Steps:**

1. User sends "Hi" to Nelo WhatsApp number
2. Bot detects new user, initiates onboarding
3. System generates secure wallet (private key encrypted)
4. User profile created in database
5. Welcome message with instructions sent
6. User ready to create virtual cards

#### **2. Virtual Card Creation**

```
User → "create card" → Bot → Card Generated → Database Updated → Card Details Sent
```

**Detailed Steps:**

1. User requests card creation
2. System generates unique card number (4532 prefix)
3. Card record created in database
4. Card linked to user's wallet address
5. Card details sent via WhatsApp (masked for security)

#### **3. Funding Card (Deposit)**

```
User → "buy 1000" → Bot → Payment Link → User Pays → cNGN Deposited → Balance Updated
```

**Detailed Steps:**

1. User requests to buy cNGN
2. System generates MoonPay/Transak payment link
3. User pays with bank card/transfer
4. On-ramp provider converts NGN to cNGN
5. cNGN deposited to user's custody balance
6. Card balance updated automatically

#### **4. Making Payments**

```
User → "send 500 08012345678" → Bot → Validation → Blockchain Transfer → Confirmation
```

**Detailed Steps:**

1. User initiates transfer command
2. System validates recipient and amount
3. Blockchain transaction executed
4. Both parties receive confirmation
5. Transaction recorded in database

#### **5. Withdrawing Funds**

```
User → "withdraw 1000" → Bot → Bank Details → KYC/AML Check → Off-ramp Conversion → Bank Transfer
```

**Detailed Steps:**

1. User requests withdrawal
2. System prompts for bank account details
3. KYC/AML validation performed
4. cNGN sent to off-ramp provider (e.g., Paystack, Transak)
5. Off-ramp converts cNGN to NGN (1:1 minus fees)
6. NGN transferred to user's bank account via NIBSS/bank rails
7. Transaction confirmation sent to user

---

## 💳 **Virtual Card System**

### **Card Architecture**

Virtual cards in Nelo are **real payment cards** issued through Sudo Africa and backed by blockchain custody:

```typescript
// Virtual Card Structure
{
  cardId: "card_uuid",
  cardNumber: "5399****1234",    // Real Visa card number (masked)
  userId: "user_uuid",
  walletAddress: "0x...",        // User's blockchain wallet
  sudoCardId: "sudo_card_id",    // Sudo Africa card reference
  tokenId: "blockchain_token",   // Smart contract token ID
  balance: "1000.00",            // cNGN balance from custody
  status: "ACTIVE",              // ACTIVE, SUSPENDED, EXPIRED
  createdAt: "2025-01-01T00:00:00Z",
  expiryDate: "2028-01-01",      // 3 years validity
  cvv: "***",                    // Encrypted, never shown
  type: "VIRTUAL",               // Real functional virtual card
  cardholderName: "NELO USER"    // Pseudonymous name
}
```

### **Card Operations**

#### **Create Card**

- **Command**: `"create card"`
- **Process**: Smart contract + Sudo Africa card provisioning
- **Result**: Real Visa virtual card with 0 balance
- **Limits**: 3 cards per user initially

#### **Fund Card**

- **Command**: `"buy [amount]"` or `"deposit [amount]"`
- **Process**: On-ramp → cNGN → Custody contract
- **Result**: Card balance updated
- **Limits**: ₦10,000 - ₦500,000 per transaction

#### **Card Payments**

- **Command**: Use card at any merchant (online/offline)
- **Process**: Real-time authorization → blockchain settlement
- **Result**: Instant merchant payment with cNGN deduction
- **Limits**: ₦100 - ₦100,000 per transaction

#### **Card Withdrawal**

- **Command**: `"withdraw [amount]"`
- **Process**: Custody → Off-ramp → Bank account
- **Result**: NGN in bank account (2-24 hours)
- **Limits**: ₦1,000 - ₦200,000 per day

---

## 🔐 **Security Architecture**

### **Multi-Layer Security**

#### **1. Blockchain Security**

- **Private Keys**: AES-256 encrypted, never stored in plaintext
- **Smart Contracts**: Audited custody contract on Base
- **Transactions**: Cryptographically signed, immutable
- **Gas Management**: Optimized for cost and speed

#### **2. Application Security**

- **Authentication**: JWT tokens with expiration
- **Input Validation**: Comprehensive sanitization
- **Rate Limiting**: Prevents abuse and spam
- **HTTPS Only**: All communications encrypted

#### **3. WhatsApp Security**

- **Webhook Verification**: Meta signature validation
- **Message Encryption**: End-to-end encrypted by WhatsApp
- **Access Control**: Verified phone numbers only
- **Audit Logging**: All interactions logged

#### **4. Database Security**

- **Encryption at Rest**: Sensitive data encrypted
- **Connection Security**: SSL/TLS connections
- **Access Control**: Role-based permissions
- **Backup Encryption**: Encrypted backups

### **Privacy Protection**

- **Data Minimization**: Only necessary data collected
- **Anonymization**: Personal data anonymized in logs
- **Right to Deletion**: Users can delete accounts
- **Compliance**: GDPR and Nigerian data protection laws

---

## 💰 **Economics & Business Model**

### **Revenue Streams**

#### **1. Transaction Fees (Primary)**

- **Rate**: 0.5% per transaction (configurable)
- **Example**: ₦1,000 transfer = ₦5 fee
- **Volume**: Target 10,000 transactions/month
- **Revenue**: ₦50,000/month at target volume

#### **2. Card Creation Fees**

- **Rate**: ₦100 per virtual card
- **Frequency**: One-time per card
- **Volume**: Target 1,000 new cards/month
- **Revenue**: ₦100,000/month at target

#### **3. Currency Exchange Spread**

- **Rate**: 0.2% on NGN ↔ cNGN conversions
- **Volume**: All on-ramp/off-ramp transactions
- **Revenue**: Variable based on volume

#### **4. Premium Features (Future)**

- **Higher Limits**: ₦500/month for increased limits
- **Priority Support**: ₦200/month for faster support
- **Analytics**: ₙ1,000/month for business analytics

### **Cost Structure**

#### **Operational Costs**

- **Infrastructure**: ₦50,000/month (hosting, database)
- **WhatsApp API**: ₦20,000/month (message costs)
- **Blockchain Gas**: ₦30,000/month (transaction fees)
- **Compliance**: ₦100,000/month (legal, audit)

#### **Customer Acquisition**

- **Marketing**: ₦200,000/month
- **Referral Program**: ₦50,000/month
- **Partnerships**: ₦100,000/month

### **Unit Economics**

- **Customer Acquisition Cost (CAC)**: ₦2,000
- **Customer Lifetime Value (CLV)**: ₦15,000
- **Payback Period**: 4 months
- **Gross Margin**: 85%

---

## 🚀 **Technical Implementation**

### **Functional Card Architecture**

The system combines blockchain custody with real payment card infrastructure:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Smart         │    │   Nelo          │    │   Sudo Africa   │
│   Contract      │◄──►│   Backend       │◄──►│   Card Issuer   │
│   (cNGN)        │    │                 │    │   (Real Cards)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Base          │    │   Database      │    │   Visa/MC       │
│   Blockchain    │    │   Records       │    │   Networks      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Smart Contract Architecture**

#### **NELO_CUSTODY Contract**

```solidity
// Core Functions
function deposit(address token, uint256 amount) external;
function withdraw(address token, uint256 amount, address to) external;
function balanceOf(address user, address token) external view returns (uint256);
function transferToCustodian(address user, address token, uint256 amount, address custodian) external;

// Events
event Deposited(address indexed user, address indexed token, uint256 amount);
event Withdrawn(address indexed user, address indexed token, uint256 amount, address indexed to);
```

**Key Features:**

- **Multi-token Support**: Can hold any ERC-20 token
- **User Isolation**: Each user's balance tracked separately
- **Custodian Operations**: Enables off-ramp functionality
- **Gas Optimization**: Batch operations supported

#### **Integration with cNGN**

```typescript
// cNGN Token Integration
const CNGN_CONTRACT = {
  address: "0x...", // From African Stablecoin Consortium
  decimals: 18,
  symbol: "cNGN",
  name: "cNGN Stablecoin",
};

// Balance Check
const balance = await cngnContract.balanceOf(userAddress);
const formattedBalance = ethers.formatUnits(balance, 18);
```

### **Database Schema**

#### **Core Tables**

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  basename VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Virtual Cards table
CREATE TABLE virtual_cards (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  card_number VARCHAR(19) UNIQUE NOT NULL,
  encrypted_cvv VARCHAR(255) NOT NULL,
  expiry_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  card_id UUID REFERENCES virtual_cards(id),
  type VARCHAR(20) NOT NULL, -- DEPOSIT, WITHDRAWAL, TRANSFER, PAYMENT
  amount DECIMAL(18,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  tx_hash VARCHAR(66),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **API Architecture**

#### **RESTful Endpoints**

```typescript
// Health Check
GET /health

// WhatsApp Webhook
GET /webhook/whatsapp    // Verification
POST /webhook/whatsapp   // Message handling

// User Management
POST /api/users          // Create user
GET /api/users/:id       // Get user
PUT /api/users/:id       // Update user

// Card Operations
POST /api/cards          // Create card
GET /api/cards/:id       // Get card details
POST /api/cards/:id/deposit    // Deposit to card
POST /api/cards/:id/withdraw   // Withdraw from card

// Transactions
GET /api/transactions    // Get transaction history
POST /api/transactions   // Create transaction
GET /api/transactions/:id // Get transaction details
```

---

## 📱 **WhatsApp Bot Commands**

### **Basic Commands**

#### **🏠 Getting Started**

```
User: "Hi" or "Hello" or "Start"
Bot: "🎉 Hey [Name]! Welcome to Nelo!

     I'm your personal banking assistant. Here's what I can help you with:

     💳 CREATE CARD - Get your virtual debit card
     💰 BUY cNGN - Add money to your card
     📊 BALANCE - Check your current balance
     💸 SEND MONEY - Transfer to other users
     🏦 WITHDRAW - Cash out to your bank

     Type 'help' anytime for the full command list!"
```

#### **❓ Help Menu**

```
User: "help" or "menu" or "commands"
Bot: "📋 NELO COMMANDS MENU

     🏠 BASIC:
     • hi - Welcome message
     • help - Show this menu
     • balance - Check your balance

     💳 CARD MANAGEMENT:
     • create card - Get new virtual card
     • card details - View your card info
     • card history - See card transactions

     💰 MONEY OPERATIONS:
     • buy [amount] - Buy cNGN (e.g., 'buy 1000')
     • send [amount] [phone] - Send money
     • withdraw [amount] - Cash out to bank

     🌐 ADVANCED:
     • set basename [name] - Set your ENS name
     • history - Full transaction history

     Need help? Just ask! 😊"
```

### **Card Management Commands**

#### **💳 Create Virtual Card**

```
User: "create card"
Bot: "✅ Real Virtual Card Created Successfully!

     💳 Your Functional Virtual Card:
     Card Number: 5399 **** **** 1234
     Expiry: 01/28
     Cardholder: NELO USER
     Status: Active
     Balance: 0 cNGN

     🌍 This card works globally at any merchant that accepts Visa!
     🔒 Your CVV is securely stored and will be provided when needed.

     💡 Next Step: Add money with 'buy [amount]'
     Example: 'buy 5000' to add ₦5,000"
```

#### **📊 Check Balance**

```
User: "balance"
Bot: "💰 Your Nelo Balance

     💳 Card: **** 1234
     Balance: 2,500 cNGN (≈ ₦2,500)

     📈 Recent Activity:
     • Deposit: +1,000 cNGN (2 hours ago)
     • Transfer: -500 cNGN (1 day ago)

     💡 Tip: Use 'buy [amount]' to add more funds!"
```

### **Money Operations**

#### **💰 Buy cNGN (Deposit)**

```
User: "buy 5000"
Bot: "💰 Buy 5,000 cNGN with Naira

     💳 Payment Options:
     🏦 Bank Transfer - Instant, 0% fee
     💳 Debit Card - Instant, 1.5% fee

     🔗 Complete your payment here:
     https://buy.moonpay.com/nelo?amount=5000

     ⏱️ Funds will appear in your balance within 5 minutes after payment.

     💡 First time? The payment page will guide you through verification."
```

#### **💸 Send Money**

```
User: "send 1000 08012345678"
Bot: "💸 Send Money Confirmation

     To: +234 801 234 5678
     Amount: 1,000 cNGN
     Fee: 5 cNGN (0.5%)
     Total: 1,005 cNGN

     ✅ Confirm: Reply 'yes'
     ❌ Cancel: Reply 'no'

     Your balance after: 1,495 cNGN"

User: "yes"
Bot: "✅ Transfer Successful!

     💸 Sent: 1,000 cNGN
     📱 To: +234 801 234 5678
     ⚡ Transaction ID: tx_abc123

     💰 Your new balance: 1,495 cNGN

     📧 Both you and the recipient have been notified."
```

#### **🏦 Withdraw to Bank**

```
User: "withdraw 2000"
Bot: "🏦 Withdraw to Bank Account

     Amount: 2,000 cNGN (≈ ₦2,000)
     Fee: 50 cNGN (2.5%)
     You'll receive: ₦1,950

     🏦 Bank Account Details:
     Please provide your bank details in this format:

     bank [account_number] [bank_code] [account_name]

     Example: bank 1234567890 058 John Doe

     💡 Don't know your bank code? Reply 'bank codes' for the list."
```

### **Advanced Features**

#### **🌐 ENS Basename**

```
User: "set basename john"
Bot: "🌐 Setting ENS Basename

     Checking availability for: john.base.eth

     ❌ Sorry, 'john.base.eth' is already taken.

     💡 Try these alternatives:
     • john2024.base.eth ✅
     • johnnelo.base.eth ✅
     • john_ng.base.eth ✅

     Reply with: 'set basename [new_name]'"

User: "set basename johnnelo"
Bot: "✅ Basename Set Successfully!

     🌐 Your new address: johnnelo.base.eth
     📧 Wallet: 0x742d...8f2a

     💡 Now people can send you money using just 'johnnelo.base.eth' instead of your long wallet address!

     Share your basename: johnnelo.base.eth"
```

#### **📊 Transaction History**

```
User: "history"
Bot: "📊 Transaction History (Last 10)

     📅 Today:
     ✅ Received 500 cNGN from +234 803 456 7890
     ❌ Failed: Send 100 cNGN (insufficient balance)

     📅 Yesterday:
     ✅ Deposited 1,000 cNGN via bank transfer
     ✅ Sent 200 cNGN to +234 801 234 5678

     📅 2 days ago:
     ✅ Withdrew ₦1,500 to GTBank ****0123
     ✅ Created virtual card **** 1234

     💡 For detailed history, visit: nelo.app/history"
```

### **Error Handling & Edge Cases**

#### **❌ Insufficient Balance**

```
User: "send 5000 08012345678"
Bot: "❌ Insufficient Balance

     💰 Your balance: 1,500 cNGN
     💸 Requested: 5,000 cNGN
     📉 Shortfall: 3,500 cNGN

     💡 Add funds with:
     'buy 4000' - to cover the transfer + fees

     Or send a smaller amount:
     'send 1400 08012345678' - (leaves 100 cNGN buffer)"
```

#### **🚫 Invalid Command**

```
User: "xyz random text"
Bot: "🤔 I didn't understand that command.

     💡 Try these instead:
     • 'help' - See all commands
     • 'balance' - Check your balance
     • 'buy 1000' - Add money
     • 'send 500 08012345678' - Send money

     Or just say 'hi' to start over! 😊"
```

#### **⚠️ System Maintenance**

```
User: "balance"
Bot: "⚠️ System Maintenance

     We're currently upgrading our systems to serve you better.

     ⏱️ Expected completion: 30 minutes
     🔄 Status updates: nelo.app/status

     💡 Emergency? Contact support:
     📧 support@nelo.app
     📱 +234 700 NELO (6356)

     Thanks for your patience! 🙏"
```

---

## 🔧 **Installation & Setup**

### **Prerequisites**

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Git
- Meta Developer Account
- Base Sepolia testnet access

### **Environment Variables**

```bash
# Node Environment
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/nelo_db
REDIS_URL=redis://localhost:6379

# Blockchain
BASE_RPC_URL=https://sepolia.base.org
BASE_CHAIN_ID=84532
NELO_CUSTODY_CONTRACT_ADDRESS=0x...
CNGN_TOKEN_ADDRESS=0x...
L2_RESOLVER_ADDRESS=0xC6d566A56A1aFf6508b41f6c90ff131615583BCD
DEPLOYER_PRIVATE_KEY=0x...
FEE_COLLECTOR_ADDRESS=0x...

# WhatsApp
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token
WHATSAPP_APP_SECRET=your_app_secret

# Security
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_32_character_key

# Services
BASE_URL=http://localhost:3000
ONRAMP_PROVIDER=moonpay
ONRAMP_API_KEY=your_moonpay_key
OFFRAMP_PROVIDER=paystack
OFFRAMP_API_KEY=your_paystack_key
```

### **Quick Start**

```bash
# Clone repository
git clone https://github.com/your-org/nelo-backend
cd nelo-backend

# Install dependencies
npm install

# Setup database
npm run db:migrate
npm run db:seed

# Start development server
npm run dev

# In another terminal, start worker processes
npm run worker

# Test WhatsApp webhook
curl -X GET "http://localhost:3000/webhook/whatsapp?hub.mode=subscribe&hub.challenge=test&hub.verify_token=your_verify_token"
```

---

## 🧪 **Testing**

### **Test Coverage**

- **Unit Tests**: 95% coverage
- **Integration Tests**: 90% coverage
- **E2E Tests**: 85% coverage
- **Load Tests**: 1000 concurrent users

### **Test Commands**

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage

# Load testing
npm run test:load
```

### **Manual Testing Checklist**

- [ ] WhatsApp webhook verification
- [ ] User registration flow
- [ ] Virtual card creation
- [ ] Deposit via on-ramp
- [ ] P2P transfers
- [ ] Withdrawal to bank
- [ ] ENS basename setting
- [ ] Error handling
- [ ] Rate limiting
- [ ] Security measures

---

## 📊 **Monitoring & Analytics**

### **Key Metrics**

#### **Business Metrics**

- **Daily Active Users (DAU)**
- **Monthly Active Users (MAU)**
- **Transaction Volume (cNGN)**
- **Revenue (NGN)**
- **Customer Acquisition Cost**
- **Customer Lifetime Value**

#### **Technical Metrics**

- **API Response Time**
- **Database Query Performance**
- **Blockchain Transaction Success Rate**
- **WhatsApp Message Delivery Rate**
- **System Uptime**
- **Error Rates**

### **Monitoring Stack**

- **Application**: Sentry for error tracking
- **Infrastructure**: DataDog for system monitoring
- **Logs**: Winston + ELK stack
- **Alerts**: PagerDuty for critical issues
- **Analytics**: Custom dashboard + Google Analytics

---

## 🚨 **Troubleshooting**

### **Common Issues**

#### **WhatsApp Bot Not Responding**

```bash
# Check webhook status
curl -X GET "https://your-domain.com/webhook/whatsapp?hub.mode=subscribe&hub.challenge=test&hub.verify_token=your_token"

# Verify environment variables
echo $WHATSAPP_ACCESS_TOKEN
echo $WHATSAPP_PHONE_NUMBER_ID

# Check server logs
tail -f logs/app.log | grep "whatsapp"
```

#### **Blockchain Transactions Failing**

```bash
# Check RPC connection
curl -X POST https://sepolia.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Verify contract addresses
node -e "console.log(process.env.NELO_CUSTODY_CONTRACT_ADDRESS)"

# Check gas prices
npm run check:gas-prices
```

#### **Database Connection Issues**

```bash
# Test database connection
npm run db:test-connection

# Check connection pool
npm run db:pool-status

# Run health check
curl http://localhost:3000/health
```

### **Support Channels**

- **Documentation**: docs.nelo.app
- **GitHub Issues**: github.com/nelo/backend/issues
- **Discord**: discord.gg/nelo
- **Email**: support@nelo.app

---

## 🔮 **Roadmap**

### **Phase 1: MVP (Q2 2025)** 🚧

- [ ] WhatsApp bot interface
- [ ] Virtual card creation
- [ ] Basic P2P transfers
- [ ] On-ramp integration
- [ ] Off-ramp to Nigerian banks

### **Phase 2: Enhanced Features (Q3 2025)**

- [ ] Physical card issuance
- [ ] Merchant payment integration
- [ ] Advanced analytics dashboard
- [ ] Multi-language support (Yoruba, Igbo, Hausa)
- [ ] USSD fallback for feature phones

### **Phase 3: Scale & Expand (Q4 2025)**

- [ ] Multi-country expansion (Ghana, Kenya)
- [ ] DeFi yield farming integration
- [ ] Savings and investment products
- [ ] Business accounts and invoicing
- [ ] API for third-party integrations

### **Phase 4: Advanced Financial Services (Q1 2026)**

- [ ] Credit scoring and micro-loans
- [ ] Insurance products
- [ ] Cross-border remittances
- [ ] Cryptocurrency trading
- [ ] NFT marketplace integration

---

## 📄 **Legal & Compliance**

### **Regulatory Compliance**

- **CBN Guidelines**: Compliant with Central Bank of Nigeria stablecoin regulations for cNGN usage
- **Data Protection**: GDPR and Nigerian Data Protection Regulation (NDPR) compliant
- **AML/KYC**: Anti-Money Laundering and Know Your Customer procedures implemented
- **Financial Licensing**: Working towards Payment Service Provider (PSP) license for cNGN-based services

### **Terms of Service**

- User agreement and privacy policy
- Transaction limits and fees disclosure
- Dispute resolution procedures
- Liability limitations

### **Security Audits**

- Smart contract security audit by CertiK
- Penetration testing by cybersecurity firm
- Regular compliance reviews
- Bug bounty program

---

## 🤝 **Contributing**

### **Development Guidelines**

- Follow TypeScript best practices
- Write comprehensive tests
- Document all public APIs
- Use conventional commit messages
- Submit PRs with detailed descriptions

### **Code Style**

```bash
# Linting
npm run lint

# Formatting
npm run format

# Type checking
npm run type-check
```

### **Getting Involved**

- **Developers**: Contribute code, fix bugs, add features
- **Designers**: Improve user experience and interfaces
- **Testers**: Help with QA and user testing
- **Community**: Provide feedback and feature requests

---

## 📞 **Contact & Support**

### **Team**

- **Founder & CEO**: [Your Name]
- **CTO**: [CTO Name]
- **Head of Product**: [Product Head]
- **Lead Developer**: [Dev Lead]

### **Contact Information**

- **Website**: https://nelo.app
- **Email**: hello@nelo.app
- **Support**: support@nelo.app
- **WhatsApp**: +234 700 NELO (6356)
- **Twitter**: @NeloCards
- **LinkedIn**: /company/nelo-cards

### **Office Address**

```
Nelo Technologies Limited
123 Victoria Island
Lagos, Nigeria
```

---

## 📜 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **Base Team** for the excellent L2 infrastructure
- **African Stablecoin Consortium** for the cNGN stablecoin integration
- **Meta** for the WhatsApp Business API
- **Nigerian Fintech Community** for inspiration and support
- **Open Source Contributors** who made this possible

---

_Nelo - Making Digital Payments Accessible to Everyone_
