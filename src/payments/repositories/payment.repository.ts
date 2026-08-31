import { Payment } from '../models/payment.model';

export interface PaymentRepository {
  create(payment: Payment): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<Payment | null>;
  update(payment: Payment): Promise<Payment>;
  findAll(): Promise<Payment[]>;
}
