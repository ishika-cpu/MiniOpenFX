import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Multiclient support
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // store only the identifier, not the full secret
  apiKeyId: text('api_key_id').notNull().unique(),
  apiKeyHash: text('api_key_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Cached balances (fast reads); source of truth is ledger_entries
export const balances = pgTable(
  "balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(), // e.g. "USD", "BTC"
    availableMinor: bigint("available_minor", { mode: "bigint" }).notNull(), // minor units
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqClientCurrency: uniqueIndex("balances_client_currency_uniq").on(
      t.clientId,
      t.currency
    ),
  })
);

export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  deltaMinor: bigint("delta_minor", { mode: "bigint" }).notNull(), // signed
  reason: text("reason").notNull(), // "DEPOSIT" | "TRADE"
  refType: text("ref_type"), // "TRADE"
  refId: uuid("ref_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),

  symbol: text("symbol").notNull(), // e.g. "BTCUSDT"
  side: text("side").notNull(), // "BUY" | "SELL"

  baseCurrency: text("base_currency").notNull(), // "BTC"
  quoteCurrency: text("quote_currency").notNull(), // "USDT"

  baseAmountMinor: bigint("base_amount_minor", { mode: "bigint" }).notNull(),
  price: text("price").notNull(), // decimal string
  quoteAmountMinor: bigint("quote_amount_minor", { mode: "bigint" }).notNull(),

  status: text("status").notNull(), // "ACTIVE" | "EXPIRED" | "EXECUTED" | "CANCELLED"
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const trades = pgTable(
  "trades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "restrict" }),

    symbol: text("symbol").notNull(),
    side: text("side").notNull(),

    baseCurrency: text("base_currency").notNull(),
    quoteCurrency: text("quote_currency").notNull(),

    baseAmountMinor: bigint("base_amount_minor", { mode: "bigint" }).notNull(),
    quoteAmountMinor: bigint("quote_amount_minor", { mode: "bigint" }).notNull(),
    price: text("price").notNull(),

    status: text("status").notNull(), // "FILLED" | "REJECTED"
    idempotencyKey: text("idempotency_key").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqQuote: uniqueIndex("trades_quote_uniq").on(t.quoteId), // 1 trade per quote
    uniqIdem: uniqueIndex("trades_client_idem_uniq").on(
      t.clientId,
      t.idempotencyKey
    ),
  })
);
