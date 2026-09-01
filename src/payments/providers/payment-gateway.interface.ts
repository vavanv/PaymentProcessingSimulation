export interface PaymentGateway {
  process(paymentId: string): Promise<boolean>;
  getProcessingDelay(): number;
}
