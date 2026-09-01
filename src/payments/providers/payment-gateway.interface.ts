export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface PaymentGateway {
  process(paymentId: string): Promise<boolean>;
  getProcessingDelay(): number;
}
