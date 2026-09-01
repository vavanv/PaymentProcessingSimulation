import { Inject, Injectable, Logger } from '@nestjs/common';
import { PAYMENT_REPOSITORY } from '../common/constants/injection-tokens';
import { PaymentStatus } from './enums/payment-status.enum';
import { Payment } from './models/payment.model';
import { PaymentStateMachine } from './payment-state-machine';
import { PaymentRepository } from './repositories/payment.repository';
import { PaymentObservabilityService } from './payment-observability.service';

export const PROCESSING_DELAY = Symbol('PROCESSING_DELAY');
export const PAYMENT_OUTCOME = Symbol('PAYMENT_OUTCOME');
export type Delay = (milliseconds: number) => Promise<void>;
export type PaymentOutcome = () => boolean;

@Injectable()
export class PaymentProcessorService {
  private readonly logger = new Logger(PaymentProcessorService.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly repository: PaymentRepository,
    @Inject(PROCESSING_DELAY) private readonly delay: Delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    @Inject(PAYMENT_OUTCOME) private readonly outcome: PaymentOutcome = () => Math.random() < 0.8,
    private readonly observability: PaymentObservabilityService,
  ) {}

  async process(id: string): Promise<void> {
    const initial = await this.repository.findById(id);
    if (!initial) {
      return;
    }

    if (initial.status === PaymentStatus.CANCELLED) {
      this.observability.logEvent(id, 'payment.cancelled', PaymentStatus.CANCELLED, 'Cancelled before processing');
      this.logger.log(`Payment ${id} processing stopped because payment was cancelled`);
      return;
    }

    if (!PaymentStateMachine.canTransition(initial.status, PaymentStatus.PROCESSING)) {
      return;
    }

    await this.repository.update({
      ...initial,
      status: PaymentStatus.PROCESSING,
      updatedAt: new Date().toISOString(),
    });

    this.observability.logEvent(id, 'payment.processing_started', PaymentStatus.PROCESSING, 'Processing started');
    this.logger.log(`Payment ${id} processing started`);

    await this.delay(this.processingDelay());

    const latest = await this.repository.findById(id);
    if (!latest || latest.status !== PaymentStatus.PROCESSING) {
      this.observability.logEvent(
        id,
        'payment.processing_completed',
        latest?.status,
        'Processing stopped before final update',
      );
      this.logger.log(`Payment ${id} processing stopped before final update`);
      return;
    }

    const status = this.outcome() ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED;

    if (!PaymentStateMachine.canTransition(latest.status, status)) {
      this.logger.warn(`Payment ${id} cannot transition to ${status} from ${latest.status}`);
      return;
    }

    const finalPayment: Payment = {
      ...latest,
      status,
      updatedAt: new Date().toISOString(),
      ...(status === PaymentStatus.FAILED ? { failureReason: 'Simulated payment processor rejection' } : {}),
    };

    await this.repository.update(finalPayment);
    this.observability.logEvent(
      id,
      status === PaymentStatus.SUCCEEDED ? 'payment.succeeded' : 'payment.failed',
      status,
      status === PaymentStatus.SUCCEEDED ? 'Payment succeeded' : 'Payment failed',
    );
    this.logger.log(`Payment ${id}: processing -> ${status}`);
  }

  protected processingDelay(): number {
    return 1000 + Math.floor(Math.random() * 2001);
  }
}
