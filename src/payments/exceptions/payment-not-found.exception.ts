import { NotFoundException } from '@nestjs/common';

export class PaymentNotFoundException extends NotFoundException {
  constructor(id: string) {
    super({ statusCode: 404, error: { code: 'PAYMENT_NOT_FOUND', message: `Payment ${id} was not found` } });
  }
}
