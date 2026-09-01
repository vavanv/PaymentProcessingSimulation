import { Injectable } from '@nestjs/common';
import { PaymentGateway } from './payment-gateway.interface';

@Injectable()
export class SimulatedPaymentGateway implements PaymentGateway {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the PaymentGateway interface
  async process(_paymentId: string): Promise<boolean> {
    // Simulated processor result
    return Math.random() < 0.8;
  }

  getProcessingDelay(): number {
    return 1000 + Math.floor(Math.random() * 2001);
  }
}
