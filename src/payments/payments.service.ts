import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PAYMENT_REPOSITORY } from '../common/constants/injection-tokens';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { PaymentStatus } from './enums/payment-status.enum';
import { InvalidPaymentTransitionException } from './exceptions/invalid-payment-transition.exception';
import { PaymentNotFoundException } from './exceptions/payment-not-found.exception';
import { Payment } from './models/payment.model';
import { PaymentProcessorService } from './payment-processor.service';
import { PaymentRepository } from './repositories/payment.repository';
import { PaymentStateMachine } from './payment-state-machine';
import { PaymentObservabilityService } from './payment-observability.service';
import { PaymentEventType } from './models/payment-event.model';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly repository: PaymentRepository,
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

    const now = new Date().toISOString();
    const payment: Payment = {
      id: `pay_${randomUUID()}`,
      amount: dto.amount,
      currency: dto.currency,
      status: PaymentStatus.PENDING,
      ...(dto.description === undefined ? {} : { description: dto.description }),
      ...(dto.idempotencyKey === undefined ? {} : { idempotencyKey: dto.idempotencyKey }),
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.create(payment);

    this.observability.logEvent(payment.id, 'payment.created', payment.status, 'Payment created');

    this.logger.log(`Payment ${payment.id} created`);

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
    const payment = await this.findById(id);

    if (!PaymentStateMachine.canTransition(payment.status, dto.status)) {
      throw new InvalidPaymentTransitionException(payment.status, dto.status);
    }

    const updated: Payment = {
      ...payment,
      status: dto.status,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.update(updated);

    const event = this.eventForStatus(dto.status);
    this.observability.logEvent(id, event, dto.status, `Payment ${dto.status}`);

    this.logger.log(`Payment ${id}: ${payment.status} -> ${dto.status}`);
    return updated;
  }

  private eventForStatus(status: PaymentStatus): PaymentEventType {
    switch (status) {
      case PaymentStatus.PROCESSING:
        return 'payment.processing_started';
      case PaymentStatus.SUCCEEDED:
        return 'payment.succeeded';
      case PaymentStatus.FAILED:
        return 'payment.failed';
      case PaymentStatus.CANCELLED:
        return 'payment.cancelled';
      default:
        throw new Error(`Unsupported payment status: ${status}`);
    }
  }
}
