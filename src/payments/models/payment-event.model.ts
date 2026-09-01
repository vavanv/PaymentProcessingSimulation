export type PaymentEventType =
  | 'payment.created'
  | 'payment.processing_skipped'
  | 'payment.processing_started'
  | 'payment.processing_completed'
  | 'payment.cancelled'
  | 'payment.failed'
  | 'payment.succeeded';

export interface PaymentEvent {
  paymentId: string;
  event: PaymentEventType;
  at: string;
  status?: string;
  message?: string;
}
