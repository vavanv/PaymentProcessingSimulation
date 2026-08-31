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

  it('does not process a cancelled payment', async () => {
    repository.findById.mockResolvedValue({ ...payment, status: PaymentStatus.CANCELLED });
    const service = new PaymentProcessorService(
      repository,
      async () => undefined,
      () => true,
    );
    await service.process(payment.id);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('does not overwrite a cancellation before final update', async () => {
    repository.findById
      .mockResolvedValueOnce(payment)
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
