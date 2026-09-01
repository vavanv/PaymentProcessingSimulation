import { Currency } from './enums/currency.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { PaymentDomainService } from './payment-domain.service';
import { PaymentRepository } from './repositories/payment.repository';

describe('PaymentDomainService', () => {
  const payment = {
    id: 'pay_1',
    amount: 10,
    currency: Currency.CAD,
    status: PaymentStatus.PENDING,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  let repository: jest.Mocked<PaymentRepository>;
  let service: PaymentDomainService;

  beforeEach(() => {
    repository = {
      create: jest.fn(async (item) => item),
      findById: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      update: jest.fn(async (item) => item),
      findAll: jest.fn(),
    };
    service = new PaymentDomainService(repository);
  });

  it('creates a pending payment with the request fields', async () => {
    const created = await service.createPending({
      amount: 25,
      currency: Currency.CAD,
      description: 'Order 1',
      idempotencyKey: 'request-1',
    });

    expect(created).toMatchObject({
      amount: 25,
      currency: Currency.CAD,
      description: 'Order 1',
      idempotencyKey: 'request-1',
      status: PaymentStatus.PENDING,
    });
    expect(created.id).toMatch(/^pay_/);
    expect(created.createdAt).toBe(created.updatedAt);
    expect(repository.create).toHaveBeenCalledWith(created);
  });

  it.each([
    [PaymentStatus.PENDING, 'cancel', PaymentStatus.CANCELLED],
    [PaymentStatus.PENDING, 'start processing', PaymentStatus.PROCESSING],
  ])('applies the %s -> %s transition', async (status, operation, nextStatus) => {
    repository.findById.mockResolvedValue({ ...payment, status });

    const updated =
      operation === 'cancel'
        ? await service.cancel(payment.id)
        : await service.startProcessing(payment.id);

    expect(updated.status).toBe(nextStatus);
    expect(repository.update).toHaveBeenCalledWith(updated);
  });

  it.each([
    [true, PaymentStatus.SUCCEEDED],
    [false, PaymentStatus.FAILED],
  ])('completes processing as %s', async (successful, status) => {
    repository.findById.mockResolvedValue({ ...payment, status: PaymentStatus.PROCESSING });

    const updated = await service.complete(payment.id, successful);

    expect(updated.status).toBe(status);
    expect(updated).toMatchObject(successful ? {} : { failureReason: 'Simulated payment processor rejection' });
    expect(repository.update).toHaveBeenCalledWith(updated);
  });

  it.each([
    ['cancel', () => service.cancel(payment.id)],
    ['start processing', () => service.startProcessing(payment.id)],
    ['complete', () => service.complete(payment.id, true)],
  ])('throws when the payment is missing for %s', async (_operation, action) => {
    repository.findById.mockResolvedValue(null);

    await expect(action()).rejects.toMatchObject({ status: 404 });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects invalid domain transitions', async () => {
    repository.findById.mockResolvedValue({ ...payment, status: PaymentStatus.SUCCEEDED });

    await expect(service.cancel(payment.id)).rejects.toMatchObject({
      status: 409,
      response: {
        error: {
          code: 'INVALID_PAYMENT_TRANSITION',
          message: 'Payment cannot transition from succeeded to cancelled',
        },
      },
    });
    expect(repository.update).not.toHaveBeenCalled();
  });
});
