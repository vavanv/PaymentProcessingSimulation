import { ConflictException } from '@nestjs/common';
import { PaymentStatus } from '../enums/payment-status.enum';

export class InvalidPaymentTransitionException extends ConflictException {
  constructor(from: PaymentStatus, to: PaymentStatus) {
    super({
      statusCode: 409,
      error: { code: 'INVALID_PAYMENT_TRANSITION', message: `Payment cannot transition from ${from} to ${to}` },
    });
  }
}
