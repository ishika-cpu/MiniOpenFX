# MiniOpenFX

A simple financial trading system with RFQ (Request for Quote) flow and double-entry ledger.

## Usage

### 1. Create a Client
To start using the API, you first need to create a client to get an API key.

```bash
curl -X POST http://localhost:3000/v1/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_API_KEY>" \
  -d '{"name": "my-trading-bot"}'
# Response: {"client_id":"...","api_key":"<uuid>.<secret>"}
```

### 2. Authenticate
Use the returned `api_key` in the `Authorization` header for all subsequent requests.

```bash
curl http://localhost:3000/v1/me \
  -H "Authorization: Bearer <your_api_key>"
```

### 3. Check Balances
New clients are seeded with test balances.
```bash
curl http://localhost:3000/v1/balances \
  -H "Authorization: Bearer <your_api_key>"
```

### Testing with Postman
1.  **Create Client**:
    - Method: `POST`
    - URL: `http://localhost:3000/v1/clients`
    - **Header**: `Authorization: Bearer <ADMIN_API_KEY>`
    - Body: `Ref` -> `JSON`: `{"name": "test_client"}`
    - **Copy** the `api_key` from the response (e.g., `uuid.secret`).

2.  **Deposit Funds**:
    - Method: `POST`
    - URL: `http://localhost:3000/v1/deposit`
    - Header: `Authorization: Bearer <YOUR_CLIENT_API_KEY>`
    - Body: `{"currency": "USDT", "amount": "1000"}`

3.  **Delete Client**:
    - Method: `DELETE`
    - URL: `http://localhost:3000/v1/clients/<client_id>`
    - **Header**: `Authorization: Bearer <YOUR_CLIENT_API_KEY>`
    - **Note**: You can only delete your own account.

3.  **Authenticate**:
    - For any other request (e.g., `GET http://localhost:3000/v1/me`), go to the **Authorization** tab.
    - Type: **Bearer Token**.
    - Token: Paste your `api_key`.

## Development

### Install Dependencies
```bash
pnpm install
```

### Run Dev Server
```bash
pnpm dev
```

### Database
Ensure PostgreSQL is running and `DATABASE_URL` is set in `.env`.
```bash
pnpm db:migrate
```
