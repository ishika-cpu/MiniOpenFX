# MiniOpenFX

A lightweight financial trading API that lets you request quotes and execute trades with a double-entry ledger system. Think of it as a mini version of a forex trading platform, but simplified for learning and experimentation.

**🚀 Live Demo:** [https://miniopenfx.onrender.com](https://miniopenfx.onrender.com)

---

## What Does This Do?

MiniOpenFX is a trading system where:
1. **Clients** can deposit funds (like USDT)
2. **Request quotes** for currency pairs (e.g., "How much BTC can I buy with $100?")
3. **Execute trades** based on those quotes
4. Everything is tracked with a **double-entry ledger** (like a bank's accounting system)

# Clone the repo
git clone https://github.com/ishika-cpu/MiniOpenFX.git
cd MiniOpenFX

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# Run database migrations
pnpm db:migrate

# Start the dev server
pnpm dev
```

The API will be running at `http://localhost:3000` 🎉

---

## How to Use the API

### 1. Create a Client (Admin Only)

First, you need to create a client account. This requires the **Admin API Key** (set in your `.env` file).

```bash
curl -X POST http://localhost:3000/v1/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -d '{"name": "alice"}'
```

**Response:**
```json
{
  "client_id": "123-456-789",
  "api_key": "abc123.xyz456"
}
```

💡 **Save that `api_key`!** This is what the client will use for all their requests.

### 2. Deposit Funds

Before trading, clients need to add funds to their account:

```bash
curl -X POST http://localhost:3000/v1/deposit \
  -H "Authorization: Bearer abc123.xyz456" \
  -H "Content-Type: application/json" \
  -d '{"currency": "USDT", "amount": "1000"}'
```

### 3. Check Your Balance

```bash
curl http://localhost:3000/v1/balances \
  -H "Authorization: Bearer abc123.xyz456"
```

### 4. Get a Price Quote

Want to know the current price for BTC/USDT?

```bash
curl "http://localhost:3000/v1/prices?symbol=BTCUSDT" \
  -H "Authorization: Bearer abc123.xyz456"
```

### 5. Request a Trade Quote

Ask "How much BTC can I buy with 100 USDT?"

```bash
curl -X POST http://localhost:3000/v1/quotes \
  -H "Authorization: Bearer abc123.xyz456" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "side": "buy",
    "quote_amount": "100"
  }'
```

**Response:**
```json
{
  "quote_id": "q_789",
  "expires_at": "2026-02-01T12:35:00Z",
  "base_amount": "0.00234",
  "quote_amount": "100"
}
```

### 6. Execute the Trade

Use the `quote_id` to execute the trade (must be done before it expires!):

```bash
curl -X POST http://localhost:3000/v1/trades \
  -H "Authorization: Bearer abc123.xyz456" \
  -H "Content-Type: application/json" \
  -d '{"quote_id": "q_789"}'
```

---

## Testing

We've included unit tests for the core money conversion logic:

```bash
# Run tests
pnpm test

# Build the project
pnpm build
```

The tests use Node's native test runner (no heavy frameworks needed).

---

## Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) (v20+)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Web Framework**: [Hono](https://hono.dev/) (Fast, lightweight, and edge-ready)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) (Type-safe and lightweight)
- **Validation**: [Zod](https://zod.dev/) (Schema-based validation)
- **Financial Math**: [Decimal.js](https://mikemcl.github.io/decimal.js/) (To prevent floating-point errors)
- **Deployment**: [Render](https://render.com/) (Using Blueprints)
- **Pricing Feed**: [CoinGecko API](https://www.coingecko.com/en/api)

---

## Architecture & Design Decisions

### How It's Built

```
┌─────────────┐
│   Client    │ (Makes API requests)
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│      Hono API Server            │
│  ┌─────────────────────────┐   │
│  │  Routes (v1/)           │   │
│  │  - /clients             │   │
│  │  - /deposit             │   │
│  │  - /quotes              │   │
│  │  - /trades              │   │
│  └─────────────────────────┘   │
└──────────┬──────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│      Services Layer              │
│  - ClientsService                │
│  - LedgerService (double-entry)  │
│  - QuotingService                │
│  - TradingService                │
│  - PricingService                │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│      Data Layer                  │
│  - Drizzle ORM                   │
│  - PostgreSQL                    │
└──────────────────────────────────┘
```

### Assumptions Made

- **Single Currency Pairs**: Only supports BTCUSDT, ETHUSDT, EURUSDT
- **Quote time**: 30 seconds(hardcoded)
- **No Order Books**: Using market prices, not limit orders
- **Trust the Pricing API**: Assuming CoinGecko prices are accurate

### Database Schema

The system uses PostgreSQL with Drizzle ORM. Here is the structure of the tables:

#### 1. `clients`
Stores client identity and authentication credentials.
- `id` (UUID): Primary key.
- `name` (Text): Human-readable name (e.g., "Alice").
- `api_key_id` (Text): Unique identifier for the API key.
- `api_key_hash` (Text): Hashed version of the API secret.
- `created_at` (Timestamp): Record creation time.

#### 2. `balances`
A cached view of each client's available funds per currency.
- `id` (UUID): Primary key.
- `client_id` (UUID): Relationship to `clients`.
- `currency` (Text): e.g., "USDT", "BTC".
- `available_minor` (BigInt): Balance in minor units (e.g., satoshis).
- `updated_at` (Timestamp): Last update time.
- *Index:* Unique on `(client_id, currency)`.

#### 3. `ledger_entries`
The immutable source of truth for all money movement.
- `id` (UUID): Primary key.
- `client_id` (UUID): Relationship to `clients`.
- `currency` (Text): The asset moved.
- `delta_minor` (BigInt): The change in balance (positive or negative).
- `reason` (Text): "DEPOSIT" or "TRADE".
- `ref_type` (Text): e.g., "TRADE" or "DEPOSIT".
- `ref_id` (UUID): Reference to the specific trade or deposit record.
- `created_at` (Timestamp): Transaction time.

#### 4. `quotes`
Temporary price agreements offered to clients.
- `id` (UUID): Primary key.
- `client_id` (UUID): Relationship to `clients`.
- `symbol` (Text): e.g., "BTCUSDT".
- `side` (Text): "BUY" or "SELL".
- `base_currency` (Text): e.g., "BTC".
- `quote_currency` (Text): e.g., "USDT".
- `base_amount_minor` (BigInt): Amount of base asset.
- `price` (Text): The agreed exchange rate.
- `quote_amount_minor` (BigInt): Amount of quote asset.
- `status` (Text): "ACTIVE", "EXPIRED", "EXECUTED", "CANCELLED".
- `expires_at` (Timestamp): When the quote becomes invalid.
- `created_at` (Timestamp): Request time.

#### 5. `trades`
Records of finalized transactions.
- `id` (UUID): Primary key.
- `client_id` (UUID): Relationship to `clients`.
- `quote_id` (UUID): Relationship to `quotes`.
- `symbol` (Text): e.g., "BTCUSDT".
- `side` (Text): "BUY" or "SELL".
- `base_currency` (Text): e.g., "BTC".
- `quote_currency` (Text): e.g., "USDT".
- `base_amount_minor` (BigInt): Executed base amount.
- `quote_amount_minor` (BigInt): Executed quote amount.
- `price` (Text): Execution price.
- `status` (Text): "FILLED" or "REJECTED".
- `idempotency_key` (Text): Unique key provided by client to prevent duplicate trades.
- `created_at` (Timestamp): Execution time.

### Trade-offs

| Decision | Why | Trade-off |
|----------|-----|-----------|
| TypeScript | Type safety, better DX | Slightly more setup than plain JS |
| Drizzle ORM | Lightweight, type-safe SQL | Less magic than Prisma, more manual queries |
| Hono Framework | Fast, edge-ready, simple | Smaller ecosystem than Express |
| CoinGecko API | Free, no auth needed | Rate limits, no bid/ask spreads |
| PostgreSQL | ACID compliance, reliable | Requires a database server (vs. SQLite) |

---

## Deployment

The project is deployed on **Render** using the included `render.yaml` blueprint.

**Live URL:** [https://miniopenfx.onrender.com](https://miniopenfx.onrender.com)

---

## Project Structure

```
src/
├── api/
│   ├── middleware/        # Auth, error handling, request ID
│   └── v1/                # API routes
├── services/              # Business logic
│   ├── clients/           # Client management
│   ├── ledger/            # Double-entry accounting
│   ├── pricing/           # Price feeds (CoinGecko)
│   ├── quoting/           # Quote generation
│   └── trading/           # Trade execution
├── db/                    # Database schema & migrations
├── domain/                # Core logic (money, errors, hashing)
└── config/                # Currency & symbol configs
```

---

## API Reference

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/v1/clients` | Admin | Create a new client |
| `GET` | `/v1/me` | Client | Get authenticated client info |
| `DELETE` | `/v1/clients/:id` | Client | Delete your own account |
| `POST` | `/v1/deposit` | Client | Add funds to your account |
| `GET` | `/v1/balances` | Client | Check your balances |
| `GET` | `/v1/prices` | Client | Get current market price |
| `POST` | `/v1/quotes` | Client | Request a trade quote |
| `POST` | `/v1/trades` | Client | Execute a quote |

---


