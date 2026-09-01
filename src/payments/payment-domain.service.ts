import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PAYMENT_REPOSITORY } from '../common/constants/injection-tokens';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentStatus } from './enums/payment-status.enum';
import { PaymentNotFoundException } from './exceptions/payment-not-found.exception';
import { Payment } from './models/payment.model';
import { PaymentStateMachine } from './payment-state-machine';
import { PaymentRepository } from './repositories/payment.repository';

@Injectable()
export class PaymentDomainService {
  private readonly logger = new Logger(PaymentDomainService.name);

  constructor(@Inject(PAYMENT_REPOSITORY) private readonly repository: PaymentRepository) {}

  /**
   * Creates a new payment in its initial lifecycle state.
   *
   * This is intentionally a domain-level factory method instead of a generic repository helper.
   * It captures the business rule that a newly created payment always begins as PENDING.
   *
   * In a POC this is enough to express the domain boundary clearly:
   * - the service owns payment creation semantics
   * - the repository is only responsible for persistence
   * - the state is not created by ad hoc code scattered across the app
   */
  async createPending(dto: CreatePaymentDto): Promise<Payment> {
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
    this.logger.log(`Domain: payment ${payment.id} created`);
    return payment;
  }

  /**
   * Cancels a payment only when the current lifecycle state allows it.
   *
   * This method is the domain-level equivalent of a business rule:
   * "a pending payment may be cancelled, but a completed payment may not."
   *
   * This is intentionally centralized so that all callers follow the same lifecycle decision.
   * The actual persistence is still delegated to the repository.
   */
  async cancel(paymentId: string): Promise<Payment> {
    const payment = await this.repository.findById(paymentId);
    if (!payment) {
      throw new PaymentNotFoundException(paymentId);
    }

    PaymentStateMachine.assertCanTransition(payment.status, PaymentStatus.CANCELLED);

    const updated: Payment = {
      ...payment,
      status: PaymentStatus.CANCELLED,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.update(updated);
    this.logger.log(`Domain: payment ${paymentId} cancelled`);
    return updated;
  }

  /**
   * Moves a payment into the processing state.
   *
   * This method encapsulates the domain rule that only a PENDING payment can begin processing.
   * This keeps the state transition logic out of the controller/service orchestration layer.
   *
   * It is also useful as a seam for future extension:
   * - provider handoff
   * - job queue integration
   * - lifecycle metrics
   */
  async startProcessing(paymentId: string): Promise<Payment> {
    const payment = await this.repository.findById(paymentId);
    if (!payment) {
      throw new PaymentNotFoundException(paymentId);
    }

    PaymentStateMachine.assertCanTransition(payment.status, PaymentStatus.PROCESSING);

    const updated: Payment = {
      ...payment,
      status: PaymentStatus.PROCESSING,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.update(updated);
    this.logger.log(`Domain: payment ${paymentId} processing started`);
    return updated;
  }

  /**
   * Completes the payment with a success or failure outcome.
   *
   * This method protects the final state transition in one place:
   * - PROCESSING -> SUCCEEDED
   * - PROCESSING -> FAILED
   *
   * The domain rule is explicit and easy to review and test.
   * This is better than scattering transition checks across multiple methods and services.
   */
  async complete(paymentId: string, successful: boolean): Promise<Payment> {
    const payment = await this.repository.findById(paymentId);
    if (!payment) {
      throw new PaymentNotFoundException(paymentId);
    }

    const nextStatus = successful ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED;
    PaymentStateMachine.assertCanTransition(payment.status, nextStatus);

    const updated: Payment = {
      ...payment,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      ...(nextStatus === PaymentStatus.FAILED ? { failureReason: 'Simulated payment processor rejection' } : {}),
    };

    await this.repository.update(updated);
    this.logger.log(`Domain: payment ${paymentId} completed as ${nextStatus}`);
    return updated;
  }
}
