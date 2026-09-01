import { Module } from '@nestjs/common';
import { PAYMENT_GATEWAY, PAYMENT_REPOSITORY } from '../common/constants/injection-tokens';
import { PaymentProcessorService } from './payment-processor.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JsonPaymentRepository } from './repositories/json-payment.repository';
import { PaymentObservabilityService } from './payment-observability.service';
import { PaymentDomainService } from './payment-domain.service';
import { SimulatedPaymentGateway } from './providers/simulated-payment-gateway';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentProcessorService,
    {
      provide: PAYMENT_GATEWAY,
      useClass: SimulatedPaymentGateway,
    },
    PaymentDomainService,
    PaymentObservabilityService,
    JsonPaymentRepository,
    { provide: PAYMENT_REPOSITORY, useExisting: JsonPaymentRepository },
  ],
})
export class PaymentsModule {}
