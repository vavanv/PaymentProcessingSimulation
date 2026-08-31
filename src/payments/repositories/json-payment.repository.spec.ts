import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Currency } from '../enums/currency.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { Payment } from '../models/payment.model';
import { JsonPaymentRepository } from './json-payment.repository';

describe('JsonPaymentRepository', () => {
  let directory: string;
  let repository: JsonPaymentRepository;
  const payment = (id: string): Payment => ({
    id,
    amount: 10,
    currency: Currency.CAD,
    status: PaymentStatus.PENDING,
    idempotencyKey: `key-${id}`,
    createdAt: '',
    updatedAt: '',
  });

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'payment-store-'));
    repository = new JsonPaymentRepository(join(directory, 'payments.json'));
    await repository.onModuleInit();
  });
  afterEach(async () => rm(directory, { recursive: true, force: true }));

  it('initializes, creates, finds, and updates payments', async () => {
    expect(await repository.findAll()).toEqual([]);
    await repository.create(payment('one'));
    expect(await repository.findById('one')).toEqual(payment('one'));
    expect(await repository.findByIdempotencyKey('key-one')).toEqual(payment('one'));
    expect(await repository.findByIdempotencyKey('missing')).toBeNull();
    await repository.update({ ...payment('one'), status: PaymentStatus.SUCCEEDED });
    expect((await repository.findById('one'))?.status).toBe(PaymentStatus.SUCCEEDED);
    expect(await repository.findById('missing')).toBeNull();
  });

  it('preserves concurrent creates', async () => {
    await Promise.all(Array.from({ length: 20 }, (_, index) => repository.create(payment(String(index)))));
    expect((await repository.findAll()).length).toBe(20);
    expect(JSON.parse(await readFile(join(directory, 'payments.json'), 'utf8'))).toHaveLength(20);
  });
});
