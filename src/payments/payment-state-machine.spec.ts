import { PaymentStatus } from './enums/payment-status.enum';
import { InvalidPaymentTransitionException } from './exceptions/invalid-payment-transition.exception';
import { PaymentStateMachine } from './payment-state-machine';

describe('PaymentStateMachine', () => {
  it.each([
    [PaymentStatus.PENDING, PaymentStatus.PROCESSING],
    [PaymentStatus.PENDING, PaymentStatus.CANCELLED],
    [PaymentStatus.PROCESSING, PaymentStatus.SUCCEEDED],
    [PaymentStatus.PROCESSING, PaymentStatus.FAILED],
  ])('allows %s -> %s', (from, to) => {
    expect(PaymentStateMachine.canTransition(from, to)).toBe(true);
    expect(() => PaymentStateMachine.assertCanTransition(from, to)).not.toThrow();
  });

  it.each([
    [PaymentStatus.PROCESSING, PaymentStatus.PENDING],
    [PaymentStatus.SUCCEEDED, PaymentStatus.PENDING],
    [PaymentStatus.FAILED, PaymentStatus.PROCESSING],
    [PaymentStatus.CANCELLED, PaymentStatus.PROCESSING],
    [PaymentStatus.PENDING, PaymentStatus.SUCCEEDED],
  ])('rejects %s -> %s', (from, to) => {
    expect(PaymentStateMachine.canTransition(from, to)).toBe(false);
    try {
      PaymentStateMachine.assertCanTransition(from, to);
      fail('Expected an invalid payment transition exception');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(InvalidPaymentTransitionException);
      expect((error as InvalidPaymentTransitionException).getResponse()).toEqual({
        statusCode: 409,
        error: {
          code: 'INVALID_PAYMENT_TRANSITION',
          message: `Payment cannot transition from ${from} to ${to}`,
        },
      });
    }
  });

  it.each([PaymentStatus.SUCCEEDED, PaymentStatus.FAILED, PaymentStatus.CANCELLED])(
    'treats %s as terminal',
    (status) => {
      expect(PaymentStateMachine.canTransition(status, status)).toBe(false);
    },
  );
});
