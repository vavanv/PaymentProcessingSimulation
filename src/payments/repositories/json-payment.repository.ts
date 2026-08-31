import { Injectable, Logger, Optional } from '@nestjs/common';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Payment } from '../models/payment.model';
import { PaymentRepository } from './payment.repository';

@Injectable()
export class JsonPaymentRepository implements PaymentRepository {
  private readonly logger = new Logger(JsonPaymentRepository.name);
  private readonly filePath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(@Optional() filePath?: string) {
    this.filePath = filePath ?? join(process.cwd(), 'data', 'payments.json');
  }

  async onModuleInit(): Promise<void> {
    await this.ensureStore();
  }

  async create(payment: Payment): Promise<Payment> {
    await this.mutate((payments) => [...payments, payment]);
    return payment;
  }

  async findById(id: string): Promise<Payment | null> {
    const payments = await this.readPayments();
    return payments.find((payment) => payment.id === id) ?? null;
  }

  async update(payment: Payment): Promise<Payment> {
    await this.mutate((payments) => {
      const index = payments.findIndex((item) => item.id === payment.id);
      if (index < 0) return payments;
      const next = [...payments];
      next[index] = payment;
      return next;
    });
    return payment;
  }

  async findAll(): Promise<Payment[]> {
    return this.readPayments();
  }

  private async ensureStore(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      await readFile(this.filePath, 'utf8');
    } catch (error: unknown) {
      if (this.isNodeError(error, 'ENOENT')) await writeFile(this.filePath, '[]\n', 'utf8');
      else throw error;
    }
  }

  private async readPayments(): Promise<Payment[]> {
    await this.ensureStore();
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Payment store must contain a JSON array');
      return parsed as Payment[];
    } catch (error: unknown) {
      this.logger.error(`Unable to read payment store: ${this.errorMessage(error)}`);
      throw error;
    }
  }

  private async mutate(change: (payments: Payment[]) => Payment[]): Promise<void> {
    const operation = async (): Promise<void> => {
      const current = await this.readPayments();
      const next = change(current);
      const temporaryPath = `${this.filePath}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      await rename(temporaryPath, this.filePath);
    };
    const queued = this.writeQueue.catch(() => undefined).then(operation);
    this.writeQueue = queued.then(
      () => undefined,
      () => undefined,
    );
    await queued;
  }

  private isNodeError(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
