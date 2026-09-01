import { Currency } from './enums/currency.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { PaymentProcessorService } from './payment-processor.service';
import { PaymentRepository } from './repositories/payment.repository';
import { PaymentObservabilityService } from './payment-observability.service';

describe('PaymentProcessorService', () => {
  const payment = {
    id: 'pay_1',
    amount: 1,
    currency: Currency.CAD,
    status: PaymentStatus.PENDING,
    createdAt: '',
    updatedAt: '',
  };
  let repository: jest.Mocked<PaymentRepository>;
  let observability: jest.Mocked<PaymentObservabilityService>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      update: jest.fn(async (item) => item),
      findAll: jest.fn(),
    };
    observability = { logEvent: jest.fn() } as unknown as jest.Mocked<PaymentObservabilityService>;
  });

  it('processes successfully', async () => {
    repository.findById
      .mockResolvedValueOnce(payment)
      .mockResolvedValueOnce({ ...payment, status: PaymentStatus.PROCESSING });
    const service = new PaymentProcessorService(
      repository,
      async () => undefined,
      () => true,
      observability,
    );
    await service.process(payment.id);
    expect(repository.update).toHaveBeenCalledTimes(2);
    expect(repository.update.mock.calls[1][0]).toMatchObject({ status: PaymentStatus.SUCCEEDED });
    expect(observability.logEvent).toHaveBeenNthCalledWith(
      1,
      payment.id,
      'payment.processing_started',
      PaymentStatus.PROCESSING,
      'Processing started',
    );
    expect(observability.logEvent).toHaveBeenNthCalledWith(
      2,
      payment.id,
      'payment.succeeded',
      PaymentStatus.SUCCEEDED,
      'Payment succeeded',
    );
  });

  it('marks a payment as failed when the processor rejects it', async () => {
    repository.findById
      .mockResolvedValueOnce(payment)
      .mockResolvedValueOnce({ ...payment, status: PaymentStatus.PROCESSING });
    const service = new PaymentProcessorService(
      repository,
      async () => undefined,
      () => false,
      observability,
    );

    await service.process(payment.id);

    expect(repository.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: PaymentStatus.FAILED,
        failureReason: 'Simulated payment processor rejection',
      }),
    );
    expect(observability.logEvent).toHaveBeenNthCalledWith(
      2,
      payment.id,
      'payment.failed',
      PaymentStatus.FAILED,
      'Payment failed',
    );
  });

  it.each([PaymentStatus.SUCCEEDED, PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.PROCESSING])(
    'does not process a %s payment',
    async (status) => {
      repository.findById.mockResolvedValue({ ...payment, status });
      const service = new PaymentProcessorService(
        repository,
        async () => undefined,
        () => true,
        observability,
      );
      await service.process(payment.id);
      expect(repository.update).not.toHaveBeenCalled();
      if (status === PaymentStatus.CANCELLED) {
        expect(observability.logEvent).toHaveBeenCalledWith(
          payment.id,
          'payment.cancelled',
          PaymentStatus.CANCELLED,
          'Cancelled before processing',
        );
      } else {
        expect(observability.logEvent).not.toHaveBeenCalled();
      }
    },
  );

  it('does not overwrite a cancellation before final update', async () => {
    repository.findById
      .mockResolvedValueOnce(payment)
      .mockResolvedValueOnce({ ...payment, status: PaymentStatus.CANCELLED });
    const service = new PaymentProcessorService(
      repository,
      async () => undefined,
      () => true,
      observability,
    );
    await service.process(payment.id);
    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(observability.logEvent).toHaveBeenNthCalledWith(
      1,
      payment.id,
      'payment.processing_started',
      PaymentStatus.PROCESSING,
      'Processing started',
    );
    expect(observability.logEvent).toHaveBeenNthCalledWith(
      2,
      payment.id,
      'payment.processing_completed',
      PaymentStatus.CANCELLED,
      'Processing stopped before final update',
    );
  });
});
