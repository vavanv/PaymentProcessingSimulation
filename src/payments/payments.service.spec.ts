import { PaymentStatus } from './enums/payment-status.enum';
import { PaymentsService } from './payments.service';
import { PaymentRepository } from './repositories/payment.repository';
import { PaymentProcessorService } from './payment-processor.service';
import { Currency } from './enums/currency.enum';
import { PaymentObservabilityService } from './payment-observability.service';

describe('PaymentsService', () => {
  let repository: jest.Mocked<PaymentRepository>;
  let processor: jest.Mocked<PaymentProcessorService>;
  let observability: jest.Mocked<PaymentObservabilityService>;
  let service: PaymentsService;

  beforeEach(() => {
    repository = {
      create: jest.fn(async (payment) => payment),
      findById: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      update: jest.fn(async (payment) => payment),
      findAll: jest.fn(),
    };
    processor = { process: jest.fn(async () => undefined) } as unknown as jest.Mocked<PaymentProcessorService>;
    observability = { logEvent: jest.fn() } as unknown as jest.Mocked<PaymentObservabilityService>;
    service = new PaymentsService(repository, processor, observability);
  });

  it('creates a pending payment and triggers processing without awaiting it', async () => {
    const payment = await service.create({ amount: 100, currency: Currency.CAD });
    expect(payment).toMatchObject({ amount: 100, currency: Currency.CAD, status: PaymentStatus.PENDING });
    expect(payment.id).toMatch(/^pay_/);
    expect(payment.createdAt).toBe(payment.updatedAt);
    expect(repository.create).toHaveBeenCalledWith(payment);
    expect(processor.process).toHaveBeenCalledWith(payment.id);
    expect(observability.logEvent).toHaveBeenCalledWith(
      payment.id,
      'payment.created',
      PaymentStatus.PENDING,
      'Payment created',
    );
  });

  it('returns an existing payment for a reused idempotency key', async () => {
    const existing = {
      id: 'pay_existing',
      amount: 100,
      currency: Currency.CAD,
      status: PaymentStatus.PROCESSING,
      idempotencyKey: 'request-123',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
    };
    repository.findByIdempotencyKey.mockResolvedValue(existing);

    await expect(
      service.create({ amount: 999, currency: Currency.CAD, idempotencyKey: 'request-123' }),
    ).resolves.toEqual(existing);
    expect(repository.create).not.toHaveBeenCalled();
    expect(processor.process).not.toHaveBeenCalled();
  });

  it('persists an idempotency key when creating a payment', async () => {
    const payment = await service.create({ amount: 100, currency: Currency.CAD, idempotencyKey: 'request-123' });

    expect(payment.idempotencyKey).toBe('request-123');
    expect(repository.findByIdempotencyKey).toHaveBeenCalledWith('request-123');
    expect(repository.create).toHaveBeenCalledWith(payment);
  });

  it.each([
    [PaymentStatus.PENDING, PaymentStatus.PROCESSING, 'payment.processing_started'],
    [PaymentStatus.PENDING, PaymentStatus.CANCELLED, 'payment.cancelled'],
    [PaymentStatus.PROCESSING, PaymentStatus.SUCCEEDED, 'payment.succeeded'],
    [PaymentStatus.PROCESSING, PaymentStatus.FAILED, 'payment.failed'],
  ])('allows %s to transition to %s', async (from, to, event) => {
    const payment = {
      id: 'pay_1',
      amount: 1,
      currency: Currency.CAD,
      status: from,
      createdAt: '',
      updatedAt: '',
    };
    repository.findById.mockResolvedValue(payment);
    const updated = await service.updateStatus(payment.id, { status: to });
    expect(updated.status).toBe(to);
    expect(repository.update).toHaveBeenCalledWith(updated);
    expect(observability.logEvent).toHaveBeenCalledWith(payment.id, event, to, `Payment ${to}`);
  });

  it.each([
    [PaymentStatus.PROCESSING, PaymentStatus.PENDING],
    [PaymentStatus.SUCCEEDED, PaymentStatus.CANCELLED],
    [PaymentStatus.FAILED, PaymentStatus.PROCESSING],
    [PaymentStatus.CANCELLED, PaymentStatus.PROCESSING],
  ])('rejects %s to %s', async (from, to) => {
    repository.findById.mockResolvedValue({
      id: 'pay_1',
      amount: 1,
      currency: Currency.CAD,
      status: from,
      createdAt: '',
      updatedAt: '',
    });

    await expect(service.updateStatus('pay_1', { status: to })).rejects.toMatchObject({ status: 409 });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('throws for a missing payment', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toMatchObject({ status: 404 });
  });
});
