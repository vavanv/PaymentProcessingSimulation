import { Currency } from '../enums/currency.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

export interface Payment {
  id: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  description?: string;
  idempotencyKey?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}
