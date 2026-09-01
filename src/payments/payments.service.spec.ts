import { PaymentStatus } from './enums/payment-status.enum';
import { PaymentsService } from './payments.service';
import { PaymentRepository } from './repositories/payment.repository';
import { PaymentProcessorService } from './payment-processor.service';
import { Currency } from './enums/currency.enum';
import { PaymentDomainService } from './payment-domain.service';
import { PaymentObservabilityService } from './payment-observability.service';

describe('PaymentsService', () => {
  let repository: jest.Mocked<PaymentRepository>;
  let domain: jest.Mocked<PaymentDomainService>;
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
    domain = {
      createPending: jest.fn(),
      cancel: jest.fn(),
      startProcessing: jest.fn(),
      complete: jest.fn(),
    } as unknown as jest.Mocked<PaymentDomainService>;
    processor = { process: jest.fn(async () => undefined) } as unknown as jest.Mocked<PaymentProcessorService>;
    observability = { logEvent: jest.fn() } as unknown as jest.Mocked<PaymentObservabilityService>;
    service = new PaymentsService(repository, domain, processor, observability);
  });

  it('creates a pending payment and triggers processing without awaiting it', async () => {
    const expectedPayment = {
      id: 'pay_1',
      amount: 100,
      currency: Currency.CAD,
      status: PaymentStatus.PENDING,
      createdAt: '',
      updatedAt: '',
    };
    domain.createPending.mockResolvedValue(expectedPayment);

    const payment = await service.create({ amount: 100, currency: Currency.CAD });
    expect(payment).toMatchObject({ amount: 100, currency: Currency.CAD, status: PaymentStatus.PENDING });
    expect(payment.id).toMatch(/^pay_/);
    expect(payment.createdAt).toBe(payment.updatedAt);
    expect(domain.createPending).toHaveBeenCalledWith({ amount: 100, currency: Currency.CAD });
    expect(repository.create).not.toHaveBeenCalled();
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
    domain.createPending.mockImplementation(async (dto) => ({
      id: 'pay_1',
      amount: dto.amount,
      currency: dto.currency,
      status: PaymentStatus.PENDING,
      idempotencyKey: dto.idempotencyKey,
      createdAt: '',
      updatedAt: '',
    }));
    const payment = await service.create({ amount: 100, currency: Currency.CAD, idempotencyKey: 'request-123' });

    expect(payment.idempotencyKey).toBe('request-123');
    expect(repository.findByIdempotencyKey).toHaveBeenCalledWith('request-123');
    expect(domain.createPending).toHaveBeenCalledWith({ amount: 100, currency: Currency.CAD, idempotencyKey: 'request-123' });
  });

  it('cancels a payment through the domain service', async () => {
    const payment = {
      id: 'pay_1',
      amount: 1,
      currency: Currency.CAD,
      status: PaymentStatus.PENDING,
      createdAt: '',
      updatedAt: '',
    };
    const updated = { ...payment, status: PaymentStatus.CANCELLED };
    domain.cancel.mockResolvedValue(updated);

    await expect(service.updateStatus(payment.id, { status: PaymentStatus.CANCELLED })).resolves.toEqual(updated);
    expect(domain.cancel).toHaveBeenCalledWith(payment.id);
    expect(observability.logEvent).toHaveBeenCalledWith(
      payment.id,
      'payment.cancelled',
      PaymentStatus.CANCELLED,
      'Payment cancelled',
    );
  });

  it.each([PaymentStatus.PROCESSING, PaymentStatus.SUCCEEDED, PaymentStatus.FAILED])(
    'rejects unsupported status updates to %s', async (status) => {
      repository.findById.mockResolvedValue({
        id: 'pay_1',
        amount: 1,
        currency: Currency.CAD,
        status: PaymentStatus.PENDING,
        createdAt: '',
        updatedAt: '',
      });

      await expect(service.updateStatus('pay_1', { status })).rejects.toMatchObject({
        status: 409,
        response: {
          error: {
            code: 'INVALID_PAYMENT_TRANSITION',
            message: `Payment cannot transition from pending to ${status}`,
          },
        },
      });
      expect(domain.cancel).not.toHaveBeenCalled();
    },
  );

  it('throws for a missing payment', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toMatchObject({ status: 404 });
  });
});
