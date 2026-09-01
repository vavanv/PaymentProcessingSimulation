import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PaymentProcessorService } from '../src/payments/payment-processor.service';
import { JsonPaymentRepository } from '../src/payments/repositories/json-payment.repository';

describe('Payments API', () => {
  let app: INestApplication;
  const paymentStorePath = join(__dirname, 'data', 'payments.json');
  const temporaryStorePath = `${paymentStorePath}.tmp`;

  beforeEach(async () => {
    await mkdir(dirname(paymentStorePath), { recursive: true });
    await rm(paymentStorePath, { force: true });
    await rm(temporaryStorePath, { force: true });
    await writeFile(paymentStorePath, '[]\n', 'utf8');

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PaymentProcessorService)
      .useValue({ process: jest.fn(async () => undefined) })
      .overrideProvider(JsonPaymentRepository)
      .useFactory({ factory: () => new JsonPaymentRepository(paymentStorePath) })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  }, 15000);
  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('supports health and validation', async () => {
    await request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
    await request(app.getHttpServer()).post('/api/v1/payments').send({ amount: 0, currency: 'CAD' }).expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/payments')
      .send({ amount: 1, currency: 'CAD', unexpected: true })
      .expect(400);
  });

  it('creates, retrieves, and cancels a payment', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .send({ amount: 10, currency: 'CAD' })
      .expect(201);
    expect(response.body.status).toBe('pending');
    await request(app.getHttpServer()).get(`/api/v1/payments/${response.body.id}`).expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/payments/${response.body.id}/status`)
      .send({ status: 'cancelled' })
      .expect(200);
    await request(app.getHttpServer()).get('/api/v1/payments/unknown').expect(404);
  });

  it('returns the original payment for a reused idempotency key', async () => {
    const idempotencyKey = 'e2e-request-123';
    const first = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .send({ amount: 10, currency: 'CAD', idempotencyKey })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .send({ amount: 999, currency: 'CAD', idempotencyKey })
      .expect(201);

    expect(second.body).toEqual(first.body);
    await request(app.getHttpServer()).get('/api/v1/payments').expect(200).expect([first.body]);
  });

  it('rejects cancelling a payment more than once', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .send({ amount: 10, currency: 'CAD' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/payments/${response.body.id}/status`)
      .send({ status: 'cancelled' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/payments/${response.body.id}/status`)
      .send({ status: 'cancelled' })
      .expect(409);
  });

  it('rejects invalid payment transitions with a descriptive error', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .send({ amount: 10, currency: 'CAD' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/payments/${response.body.id}/status`)
      .send({ status: 'cancelled' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/payments/${response.body.id}/status`)
      .send({ status: 'cancelled' })
      .expect(409)
      .expect({
        statusCode: 409,
        error: {
          code: 'INVALID_PAYMENT_TRANSITION',
          message: 'Payment cannot transition from cancelled to cancelled',
        },
      });
  });
});
