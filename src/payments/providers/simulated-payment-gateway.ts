import { Injectable } from '@nestjs/common';
import { PaymentGateway } from './payment-gateway.interface';

/**
 * In-process payment gateway used by the simulation.
 *
 * This adapter deliberately does not contact an external provider or persist
 * gateway state. It models the two values a real gateway would provide to the
 * processor: whether the payment succeeded and how long processing takes.
 */
@Injectable()
export class SimulatedPaymentGateway implements PaymentGateway {
  /**
   * Simulates a gateway authorization/settlement attempt.
   *
   * The payment ID is part of the gateway contract so a real implementation
   * can use it to build a provider request. The simulation does not need the
   * ID, so the parameter is intentionally unused. Success is randomized with
   * an 80% probability to exercise both success and failure lifecycle paths.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the PaymentGateway interface
  async process(_paymentId: string): Promise<boolean> {
    return Math.random() < 0.8;
  }

  /**
   * Returns the simulated processing duration in milliseconds.
   *
   * A random delay between 1 and 3 seconds models asynchronous provider
   * latency while keeping the behavior deterministic at the interface level:
   * callers only need to await the configured duration.
   */
  getProcessingDelay(): number {
    return 1000 + Math.floor(Math.random() * 2001);
  }
}
