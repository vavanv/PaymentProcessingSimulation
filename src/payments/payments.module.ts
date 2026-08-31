import { Module } from '@nestjs/common';
import { PAYMENT_REPOSITORY } from '../common/constants/injection-tokens';
import { PaymentProcessorService, PAYMENT_OUTCOME, PROCESSING_DELAY } from './payment-processor.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JsonPaymentRepository } from './repositories/json-payment.repository';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentProcessorService,
    JsonPaymentRepository,
    { provide: PAYMENT_REPOSITORY, useExisting: JsonPaymentRepository },
    {
      provide: PROCESSING_DELAY,
      useValue: (ms: number): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    },
    { provide: PAYMENT_OUTCOME, useValue: (): boolean => Math.random() < 0.8 },
  ],
})
export class PaymentsModule {}
