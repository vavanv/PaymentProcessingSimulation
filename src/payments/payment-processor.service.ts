import { Inject, Injectable, Logger } from '@nestjs/common';
import { PAYMENT_GATEWAY, PAYMENT_REPOSITORY } from '../common/constants/injection-tokens';
import { PaymentStatus } from './enums/payment-status.enum';
import { PaymentDomainService } from './payment-domain.service';
import { PaymentObservabilityService } from './payment-observability.service';
import { PaymentRepository } from './repositories/payment.repository';
import { PaymentGateway } from './providers/payment-gateway.interface';

@Injectable()
export class PaymentProcessorService {
  private readonly logger = new Logger(PaymentProcessorService.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly repository: PaymentRepository,
    private readonly domain: PaymentDomainService,
    private readonly observability: PaymentObservabilityService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async process(id: string): Promise<void> {
    const initial = await this.repository.findById(id);
    if (!initial) {
      this.observability.logEvent(id, 'payment.processing_skipped', undefined, 'Processing skipped because payment was not found');
      this.logger.warn(`Payment ${id} processing skipped because payment was not found`);
      return;
    }

    if (initial.status === PaymentStatus.CANCELLED) {
      this.observability.logEvent(id, 'payment.cancelled', PaymentStatus.CANCELLED, 'Cancelled before processing');
      this.logger.log(`Payment ${id} processing stopped because payment was cancelled`);
      return;
    }

    if (initial.status !== PaymentStatus.PENDING) {
      this.observability.logEvent(
        id,
        'payment.processing_skipped',
        initial.status,
        `Processing skipped because payment is ${initial.status}`,
      );
      this.logger.log(`Payment ${id} processing skipped because payment is ${initial.status}`);
      return;
    }

    await this.domain.startProcessing(id);
    this.observability.logEvent(id, 'payment.processing_started', PaymentStatus.PROCESSING, 'Processing started');
    this.logger.log(`Payment ${id} processing started`);

    await new Promise<void>((resolve) => setTimeout(resolve, this.gateway.getProcessingDelay()));

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

    const succeeded = await this.gateway.process(id);
    const status = succeeded ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED;
    await this.domain.complete(id, succeeded);

    this.observability.logEvent(
      id,
      status === PaymentStatus.SUCCEEDED ? 'payment.succeeded' : 'payment.failed',
      status,
      status === PaymentStatus.SUCCEEDED ? 'Payment succeeded' : 'Payment failed',
    );
    this.logger.log(`Payment ${id}: processing -> ${status}`);
  }
}
