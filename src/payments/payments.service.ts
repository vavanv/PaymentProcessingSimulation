import { Inject, Injectable, Logger } from '@nestjs/common';
import { PAYMENT_REPOSITORY } from '../common/constants/injection-tokens';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { PaymentStatus } from './enums/payment-status.enum';
import { InvalidPaymentTransitionException } from './exceptions/invalid-payment-transition.exception';
import { PaymentNotFoundException } from './exceptions/payment-not-found.exception';
import { Payment } from './models/payment.model';
import { PaymentDomainService } from './payment-domain.service';
import { PaymentObservabilityService } from './payment-observability.service';
import { PaymentProcessorService } from './payment-processor.service';
import { PaymentRepository } from './repositories/payment.repository';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly repository: PaymentRepository,
    private readonly domain: PaymentDomainService,
    private readonly processor: PaymentProcessorService,
    private readonly observability: PaymentObservabilityService,
  ) {}

  async create(dto: CreatePaymentDto): Promise<Payment> {
    if (dto.idempotencyKey !== undefined) {
      const existing = await this.repository.findByIdempotencyKey(dto.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const payment = await this.domain.createPending(dto);
    this.observability.logEvent(payment.id, 'payment.created', payment.status, 'Payment created');

    void this.processor
      .process(payment.id)
      .catch((error: unknown) =>
        this.logger.error(
          `Payment ${payment.id} processing failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );

    return payment;
  }

  async findById(id: string): Promise<Payment> {
    const payment = await this.repository.findById(id);
    if (!payment) {
      throw new PaymentNotFoundException(id);
    }
    return payment;
  }

  findAll(): Promise<Payment[]> {
    return this.repository.findAll();
  }

  async updateStatus(id: string, dto: UpdatePaymentStatusDto): Promise<Payment> {
    if (dto.status !== PaymentStatus.CANCELLED) {
      const payment = await this.findById(id);
      throw new InvalidPaymentTransitionException(payment.status, dto.status);
    }

    const updated = await this.domain.cancel(id);
    this.observability.logEvent(id, 'payment.cancelled', PaymentStatus.CANCELLED, 'Payment cancelled');
    return updated;
  }
}
