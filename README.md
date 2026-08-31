# Payment Processing Simulation

A small NestJS service that simulates asynchronous payment processing using a JSON file. It is intended for demonstration and technical-assignment use, not production payments.

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
