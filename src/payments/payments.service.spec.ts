import { PaymentStatus } from './enums/payment-status.enum';
import { PaymentsService } from './payments.service';
import { PaymentRepository } from './repositories/payment.repository';
import { PaymentProcessorService } from './payment-processor.service';
import { Currency } from './enums/currency.enum';

describe('PaymentsService', () => {
  let repository: jest.Mocked<PaymentRepository>;
  let processor: jest.Mocked<PaymentProcessorService>;
  let service: PaymentsService;

  beforeEach(() => {
    repository = {
      create: jest.fn(async (payment) => payment),
      findById: jest.fn(),
      update: jest.fn(async (payment) => payment),
      findAll: jest.fn(),
    };
    processor = { process: jest.fn(async () => undefined) } as unknown as jest.Mocked<PaymentProcessorService>;
    service = new PaymentsService(repository, processor);
  });

  it('creates a pending payment and triggers processing without awaiting it', async () => {
    const payment = await service.create({ amount: 100, currency: Currency.CAD });
    expect(payment).toMatchObject({ amount: 100, currency: Currency.CAD, status: PaymentStatus.PENDING });
    expect(payment.id).toMatch(/^pay_/);
    expect(payment.createdAt).toBe(payment.updatedAt);
    expect(repository.create).toHaveBeenCalledWith(payment);
    expect(processor.process).toHaveBeenCalledWith(payment.id);
  });

  it.each([
    [PaymentStatus.PENDING, PaymentStatus.PROCESSING],
    [PaymentStatus.PENDING, PaymentStatus.CANCELLED],
    [PaymentStatus.PROCESSING, PaymentStatus.SUCCEEDED],
    [PaymentStatus.PROCESSING, PaymentStatus.FAILED],
  ])('allows %s to transition to %s', async (from, to) => {
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
