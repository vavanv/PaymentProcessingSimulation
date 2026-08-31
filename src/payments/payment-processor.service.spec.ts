import { Currency } from './enums/currency.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { PaymentProcessorService } from './payment-processor.service';
import { PaymentRepository } from './repositories/payment.repository';

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

  beforeEach(() => {
    repository = { create: jest.fn(), findById: jest.fn(), update: jest.fn(async (item) => item), findAll: jest.fn() };
  });

  it('processes successfully', async () => {
    repository.findById
      .mockResolvedValueOnce(payment)
      .mockResolvedValueOnce({ ...payment, status: PaymentStatus.PROCESSING });
    const service = new PaymentProcessorService(
      repository,
      async () => undefined,
      () => true,
    );
    await service.process(payment.id);
    expect(repository.update).toHaveBeenCalledTimes(2);
    expect(repository.update.mock.calls[1][0]).toMatchObject({ status: PaymentStatus.SUCCEEDED });
  });

  it('marks a payment as failed when the processor rejects it', async () => {
    repository.findById
      .mockResolvedValueOnce(payment)
      .mockResolvedValueOnce({ ...payment, status: PaymentStatus.PROCESSING });
    const service = new PaymentProcessorService(
      repository,
      async () => undefined,
      () => false,
    );

    await service.process(payment.id);

    expect(repository.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: PaymentStatus.FAILED,
        failureReason: 'Simulated payment processor rejection',
      }),
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
      );
      await service.process(payment.id);
      expect(repository.update).not.toHaveBeenCalled();
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
    );
    await service.process(payment.id);
    expect(repository.update).toHaveBeenCalledTimes(1);
  });
});
