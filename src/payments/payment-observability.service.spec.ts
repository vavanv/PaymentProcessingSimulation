import { Logger } from '@nestjs/common';
import { PaymentObservabilityService } from './payment-observability.service';

describe('PaymentObservabilityService', () => {
  let service: PaymentObservabilityService;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new PaymentObservabilityService();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs a structured payment event', () => {
    service.logEvent('pay_1', 'payment.created', 'pending', 'Payment created');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(logSpy.mock.calls[0][0] as string) as Record<string, string>;
    expect(payload).toEqual({
      paymentId: 'pay_1',
      event: 'payment.created',
      status: 'pending',
      at: expect.any(String),
      message: 'Payment created',
    });
    expect(Number.isNaN(Date.parse(payload.at))).toBe(false);
  });

  it('uses an empty message when no message is provided', () => {
    service.logEvent('pay_2', 'payment.processing_started', 'processing');

    const payload = JSON.parse(logSpy.mock.calls[0][0] as string) as Record<string, string>;
    expect(payload).toMatchObject({
      paymentId: 'pay_2',
      event: 'payment.processing_started',
      status: 'processing',
      message: '',
    });
  });

  it('supports events without a status', () => {
    service.logEvent('pay_3', 'payment.cancelled');

    const payload = JSON.parse(logSpy.mock.calls[0][0] as string) as Record<string, string | undefined>;
    expect(payload).toMatchObject({
      paymentId: 'pay_3',
      event: 'payment.cancelled',
      message: '',
    });
    expect(payload.status).toBeUndefined();
  });
});
