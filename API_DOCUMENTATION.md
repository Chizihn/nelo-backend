# 🔌 Nelo Virtual Cards - API Documentation

## 📋 **Overview**

The Nelo API provides programmatic access to virtual card management, blockchain operations, and user management. This RESTful API is designed for developers who want to integrate Nelo's functionality into their applications.

**Base URL**: `https://api.nelo.app/v1`  
**Authentication**: JWT Bearer Token  
**Content-Type**: `application/json`

---

## 🔐 **Authentication**

### **JWT Token Authentication**

All API requests require a valid JWT token in the Authorization header:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **Getting Access Token**

```http
POST /auth/login
Content-Type: application/json

{
  "phoneNumber": "+2348012345678",
  "otp": "123456"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "user": {
      "id": "user_123",
      "phoneNumber": "+2348012345678",
      "walletAddress": "0x742d35Cc6634C0532925a3b8D0C9964E8f2a8f2a"
    }
  }
}
```

---

## 👤 **User Management**

### **Create User**

```http
POST /users
Content-Type: application/json

{
  "phoneNumber": "+2348012345678",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "phoneNumber": "+2348012345678",
    "firstName": "John",
    "lastName": "Doe",
    "walletAddress": "0x742d35Cc6634C0532925a3b8D0C9964E8f2a8f2a",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### **Get User Profile**

```http
GET /users/me
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "phoneNumber": "+2348012345678",
    "firstName": "John",
    "lastName": "Doe",
    "walletAddress": "0x742d35Cc6634C0532925a3b8D0C9964E8f2a8f2a",
    "basename": "john.base.eth",
    "totalBalance": "2500.00",
    "cardCount": 2,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### **Update User Profile**

```http
PUT /users/me
Authorization: Bearer {token}
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Smith",
  "basename": "johnsmith.base.eth"
}
```

---

## 💳 **Virtual Cards**

### **Create Virtual Card**

```http
POST /cards
Authorization: Bearer {token}
Content-Type: application/json

{
  "cardType": "VIRTUAL",
  "currency": "cNGN"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "card_123",
    "cardNumber": "4532********1234",
    "expiryDate": "01/27",
    "status": "ACTIVE",
    "balance": "0.00",
    "currency": "cNGN",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### **Get Card Details**

```http
GET /cards/{cardId}
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "card_123",
    "cardNumber": "4532********1234",
    "expiryDate": "01/27",
    "status": "ACTIVE",
    "balance": "1500.00",
    "currency": "cNGN",
    "lastTransaction": {
      "id": "tx_456",
      "type": "DEPOSIT",
      "amount": "500.00",
      "createdAt": "2024-01-01T12:00:00.000Z"
    },
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### **List User Cards**

```http
GET /cards
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "card_123",
      "cardNumber": "4532********1234",
      "status": "ACTIVE",
      "balance": "1500.00",
      "currency": "cNGN"
    },
    {
      "id": "card_456",
      "cardNumber": "4532********5678",
      "status": "ACTIVE",
      "balance": "750.00",
      "currency": "cNGN"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 2
  }
}
```

### **Suspend/Activate Card**

```http
PATCH /cards/{cardId}/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "SUSPENDED",
  "reason": "Lost card"
}
```

---

## 💰 **Transactions**

### **Deposit to Card**

```http
POST /cards/{cardId}/deposit
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": "1000.00",
  "paymentMethod": "ONRAMP",
  "provider": "moonpay"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "transactionId": "tx_789",
    "paymentUrl": "https://buy.moonpay.com/nelo?amount=1000",
    "status": "PENDING",
    "amount": "1000.00",
    "fee": "15.00",
    "estimatedTime": "5 minutes"
  }
}
```

### **Transfer Between Users**

```http
POST /transactions/transfer
Authorization: Bearer {token}
Content-Type: application/json

{
  "fromCardId": "card_123",
  "toPhoneNumber": "+2348087654321",
  "amount": "500.00",
  "description": "Lunch money"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "transactionId": "tx_101",
    "status": "COMPLETED",
    "amount": "500.00",
    "fee": "2.50",
    "recipient": {
      "phoneNumber": "+2348087654321",
      "name": "Jane Doe"
    },
    "txHash": "0xabc123...",
    "createdAt": "2024-01-01T12:00:00.000Z"
  }
}
```

### **Withdraw to Bank**

```http
POST /cards/{cardId}/withdraw
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": "2000.00",
  "bankAccount": {
    "accountNumber": "1234567890",
    "bankCode": "058",
    "accountName": "John Doe"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "transactionId": "tx_202",
    "status": "PROCESSING",
    "amount": "2000.00",
    "fee": "50.00",
    "netAmount": "1950.00",
    "estimatedTime": "2-24 hours",
    "bankAccount": {
      "accountNumber": "****7890",
      "bankName": "GTBank"
    }
  }
}
```

### **Get Transaction History**

```http
GET /transactions?page=1&limit=20&type=DEPOSIT&status=COMPLETED
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "tx_789",
      "type": "DEPOSIT",
      "amount": "1000.00",
      "fee": "15.00",
      "status": "COMPLETED",
      "description": "MoonPay deposit",
      "txHash": "0xdef456...",
      "createdAt": "2024-01-01T10:00:00.000Z"
    },
    {
      "id": "tx_101",
      "type": "TRANSFER",
      "amount": "500.00",
      "fee": "2.50",
      "status": "COMPLETED",
      "description": "Transfer to +2348087654321",
      "txHash": "0xabc123...",
      "createdAt": "2024-01-01T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### **Get Transaction Details**

```http
GET /transactions/{transactionId}
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "tx_789",
    "type": "DEPOSIT",
    "amount": "1000.00",
    "fee": "15.00",
    "status": "COMPLETED",
    "description": "MoonPay deposit",
    "txHash": "0xdef456...",
    "blockNumber": 12345678,
    "confirmations": 12,
    "card": {
      "id": "card_123",
      "cardNumber": "4532********1234"
    },
    "metadata": {
      "provider": "moonpay",
      "paymentMethod": "bank_transfer",
      "externalId": "moonpay_abc123"
    },
    "createdAt": "2024-01-01T10:00:00.000Z",
    "completedAt": "2024-01-01T10:05:00.000Z"
  }
}
```

---

## 🌐 **Blockchain Operations**

### **Get Wallet Balance**

```http
GET /wallet/balance
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "walletAddress": "0x742d35Cc6634C0532925a3b8D0C9964E8f2a8f2a",
    "balances": [
      {
        "token": "cNGN",
        "address": "0x...",
        "balance": "2500.00",
        "decimals": 18
      },
      {
        "token": "ETH",
        "address": "native",
        "balance": "0.05",
        "decimals": 18
      }
    ],
    "totalValueUSD": "2525.00"
  }
}
```

### **Set ENS Basename**

```http
POST /wallet/basename
Authorization: Bearer {token}
Content-Type: application/json

{
  "basename": "john.base.eth"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "basename": "john.base.eth",
    "walletAddress": "0x742d35Cc6634C0532925a3b8D0C9964E8f2a8f2a",
    "txHash": "0x123abc...",
    "status": "PENDING",
    "estimatedTime": "2-5 minutes"
  }
}
```

### **Get Gas Estimates**

```http
GET /blockchain/gas-estimate?operation=transfer&amount=100
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "operation": "transfer",
    "gasLimit": "21000",
    "gasPrice": "2000000000",
    "maxFeePerGas": "2000000000",
    "maxPriorityFeePerGas": "1000000000",
    "estimatedCostETH": "0.000042",
    "estimatedCostUSD": "0.10"
  }
}
```

---

## 📊 **Analytics & Reporting**

### **Get User Statistics**

```http
GET /analytics/user-stats
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalTransactions": 45,
    "totalVolume": "15750.00",
    "totalFees": "78.75",
    "averageTransactionSize": "350.00",
    "monthlyStats": {
      "transactions": 12,
      "volume": "4200.00",
      "fees": "21.00"
    },
    "topCategories": [
      {
        "type": "TRANSFER",
        "count": 25,
        "volume": "8500.00"
      },
      {
        "type": "DEPOSIT",
        "count": 15,
        "volume": "6000.00"
      }
    ]
  }
}
```

### **Get Card Performance**

```http
GET /analytics/cards/{cardId}/performance?period=30d
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "cardId": "card_123",
    "period": "30d",
    "transactions": 28,
    "totalVolume": "8750.00",
    "averageBalance": "1250.00",
    "dailyActivity": [
      {
        "date": "2024-01-01",
        "transactions": 3,
        "volume": "450.00"
      }
    ],
    "categoryBreakdown": {
      "deposits": "3500.00",
      "transfers": "4250.00",
      "withdrawals": "1000.00"
    }
  }
}
```

---

## 🔔 **Webhooks**

### **Webhook Configuration**

```http
POST /webhooks
Authorization: Bearer {token}
Content-Type: application/json

{
  "url": "https://your-app.com/webhooks/nelo",
  "events": ["transaction.completed", "card.created", "deposit.confirmed"],
  "secret": "your_webhook_secret"
}
```

### **Webhook Events**

#### **Transaction Completed**

```json
{
  "event": "transaction.completed",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "data": {
    "transactionId": "tx_789",
    "userId": "user_123",
    "cardId": "card_123",
    "type": "TRANSFER",
    "amount": "500.00",
    "status": "COMPLETED",
    "txHash": "0xabc123..."
  }
}
```

#### **Card Created**

```json
{
  "event": "card.created",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "data": {
    "cardId": "card_456",
    "userId": "user_123",
    "cardNumber": "4532********5678",
    "status": "ACTIVE"
  }
}
```

#### **Deposit Confirmed**

```json
{
  "event": "deposit.confirmed",
  "timestamp": "2024-01-01T10:05:00.000Z",
  "data": {
    "transactionId": "tx_789",
    "userId": "user_123",
    "cardId": "card_123",
    "amount": "1000.00",
    "confirmations": 12,
    "txHash": "0xdef456..."
  }
}
```

---

## ❌ **Error Handling**

### **Error Response Format**

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance for this transaction",
    "details": {
      "currentBalance": "100.00",
      "requiredAmount": "500.00",
      "shortfall": "400.00"
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z",
  "requestId": "req_abc123"
}
```

### **Common Error Codes**

| Code                   | HTTP Status | Description                        |
| ---------------------- | ----------- | ---------------------------------- |
| `INVALID_TOKEN`        | 401         | JWT token is invalid or expired    |
| `INSUFFICIENT_BALANCE` | 400         | Not enough balance for transaction |
| `CARD_NOT_FOUND`       | 404         | Card ID does not exist             |
| `CARD_SUSPENDED`       | 403         | Card is suspended or inactive      |
| `INVALID_AMOUNT`       | 400         | Amount is invalid or out of range  |
| `RATE_LIMIT_EXCEEDED`  | 429         | Too many requests                  |
| `BLOCKCHAIN_ERROR`     | 500         | Blockchain transaction failed      |
| `VALIDATION_ERROR`     | 400         | Request validation failed          |

---

## 🔒 **Rate Limiting**

### **Rate Limits**

- **Authentication**: 5 requests per minute
- **Card Operations**: 10 requests per minute
- **Transactions**: 20 requests per minute
- **Analytics**: 100 requests per hour

### **Rate Limit Headers**

```http
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1640995200
```

---

## 🧪 **Testing**

### **Sandbox Environment**

**Base URL**: `https://sandbox-api.nelo.app/v1`

### **Test Data**

```json
{
  "testUser": {
    "phoneNumber": "+2348000000001",
    "otp": "123456"
  },
  "testCard": {
    "cardNumber": "4532000000001234",
    "cvv": "123",
    "expiryDate": "12/27"
  },
  "testAmounts": {
    "deposit": "1000.00",
    "transfer": "100.00",
    "withdraw": "500.00"
  }
}
```

### **Postman Collection**

Download our Postman collection: [Nelo API Collection](https://api.nelo.app/postman/collection.json)

---

## 📚 **SDKs & Libraries**

### **JavaScript/Node.js**

```bash
npm install @nelo/sdk
```

```javascript
import { NeloSDK } from "@nelo/sdk";

const nelo = new NeloSDK({
  apiKey: "your_api_key",
  environment: "sandbox", // or 'production'
});

// Create a card
const card = await nelo.cards.create({
  cardType: "VIRTUAL",
  currency: "cNGN",
});

// Make a transfer
const transfer = await nelo.transactions.transfer({
  fromCardId: "card_123",
  toPhoneNumber: "+2348087654321",
  amount: "500.00",
});
```

### **Python**

```bash
pip install nelo-python
```

```python
from nelo import NeloClient

client = NeloClient(
    api_key='your_api_key',
    environment='sandbox'
)

# Create a card
card = client.cards.create(
    card_type='VIRTUAL',
    currency='cNGN'
)

# Make a transfer
transfer = client.transactions.transfer(
    from_card_id='card_123',
    to_phone_number='+2348087654321',
    amount='500.00'
)
```

---

## 📞 **Support**

### **API Support**

- **Documentation**: https://docs.nelo.app/api
- **Status Page**: https://status.nelo.app
- **Support Email**: api-support@nelo.app
- **Discord**: https://discord.gg/nelo-developers

### **Response Times**

- **Critical Issues**: 1 hour
- **General Support**: 24 hours
- **Feature Requests**: 1 week

---

**API Version**: v1.0.0  
**Last Updated**: January 2024  
**Next Version**: v1.1.0 (Q2 2024)
