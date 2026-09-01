# Payment Processing Simulation

A small NestJS service that simulates asynchronous payment processing using a JSON file. It is intended for demonstration and technical-assignment use, not production payments.

## Implementation plan

- `chat-gpt-session-transcript.md` - Architecture discussion transcript

- `plan.md` - Codex implementation plan

## Requirements and setup

Node.js 22+ and npm are required.

```bash npm
npm install
npm run start:dev

or yarn

yarn
yarn start:dev
```

Build and test with `npm run build`, `npm test`, and `npm run test:e2e` (`yarn build`,`yarn test`, and `yarn test:e2e`).

Swagger is available at `http://localhost:3000/api/docs`.

## API

- `POST /api/v1/payments` with `{ "amount": 100, "currency": "CAD", "description": "Order #1" }`
- `GET /api/v1/payments/:id`
- `GET /api/v1/payments`
- `PATCH /api/v1/payments/:id/status` with `{ "status": "cancelled" }`
- `GET /health`

The lifecycle is `PENDING -> PROCESSING -> SUCCEEDED/FAILED`.

The repository abstraction keeps persistence replaceable. JSON storage is intentionally simple and unsuitable for distributed production deployment; a real service would use a transactional database and durable worker queue.

## TESTING

1. `Health check`

   curl -i http://localhost:3000/health

   expected 200 OK - {"status":"ok"}. If it is not returning 200, make sure the service is running (npm run start:dev or yarn start:dev)

2. `Create a payment`

   curl -i -X POST http://localhost:3000/api/v1/payments -H "Content-Type: application/json" -d '{"amount":100,"currency":"CAD","description":"Order #1"}'

   expected 201 Created

3. `Read one payment by ID`

   Replace the <payment_id> from the create response:

   curl -i http://localhost:3000/api/v1/payments/<payment_id>

   expected 200 OK

4. `Cancel a payment`

   Replace the <payment_id> from the create response

   curl -i -X PATCH http://localhost:3000/api/v1/payments/<payment_id>/status -H "Content-Type: application/json" -d '{"status":"cancelled"}'

   expected 409 Conflict - {"statusCode":409,"error":{"code":"INVALID_PAYMENT_TRANSITION","message":"Payment cannot transition from succeeded to cancelled"}}

5. `Read all payments`

   curl -i http://localhost:3000/api/v1/payments

   expected 200 OK and all payments from data/payments.json

6. `Test idempotency enforcement`

   Sent the same create request two time.

   curl -i -X POST http://localhost:3000/api/v1/payments -H "Content-Type: application/json" -d '{"amount": 100,"currency": "CAD","description": "Order #1","idempotencyKey": "order-123"}'

   expected 201 Created - the system returns the same ID and payment details for both requests, preventing the creation of a duplicate payment
