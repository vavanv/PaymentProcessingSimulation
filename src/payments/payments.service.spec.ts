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

  it('allows only pending to cancelled', async () => {
    const payment = {
      id: 'pay_1',
      amount: 1,
      currency: Currency.CAD,
      status: PaymentStatus.PENDING,
      createdAt: '',
      updatedAt: '',
    };
    repository.findById.mockResolvedValue(payment);
    const cancelled = await service.updateStatus(payment.id, { status: PaymentStatus.CANCELLED });
    expect(cancelled.status).toBe(PaymentStatus.CANCELLED);
    repository.findById.mockResolvedValue({ ...payment, status: PaymentStatus.SUCCEEDED });
    await expect(service.updateStatus(payment.id, { status: PaymentStatus.CANCELLED })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('throws for a missing payment', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toMatchObject({ status: 404 });
  });
});
