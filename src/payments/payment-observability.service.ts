import { Injectable, Logger } from '@nestjs/common';
import { PaymentEvent, PaymentEventType } from './models/payment-event.model';

@Injectable()
export class PaymentObservabilityService {
  private readonly logger = new Logger(PaymentObservabilityService.name);

  logEvent(paymentId: string, event: PaymentEventType, status?: string, message?: string): void {
    const entry: PaymentEvent = {
      paymentId,
      event,
      at: new Date().toISOString(),
      status,
      message,
    };

    this.logger.log(
      JSON.stringify({
        paymentId: entry.paymentId,
        event: entry.event,
        status: entry.status,
        at: entry.at,
        message: entry.message ?? '',
      }),
    );
  }
}
