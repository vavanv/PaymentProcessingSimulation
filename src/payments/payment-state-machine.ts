import { PaymentStatus } from './enums/payment-status.enum';
import { InvalidPaymentTransitionException } from './exceptions/invalid-payment-transition.exception';

export class PaymentStateMachine {
  /**
   * Defines the valid lifecycle transitions for the POC payment model.
   * This intentionally keeps the rules explicit and easy to read.
   *
   * PENDING -> PROCESSING
   * PENDING -> CANCELLED
   * PROCESSING -> SUCCEEDED
   * PROCESSING -> FAILED
   *
   * Terminal states:
   * - SUCCEEDED
   * - FAILED
   * - CANCELLED
   */
  private static readonly transitions: Record<PaymentStatus, PaymentStatus[]> = {
    [PaymentStatus.PENDING]: [PaymentStatus.PROCESSING, PaymentStatus.CANCELLED],
    [PaymentStatus.PROCESSING]: [PaymentStatus.SUCCEEDED, PaymentStatus.FAILED],
    [PaymentStatus.SUCCEEDED]: [],
    [PaymentStatus.FAILED]: [],
    [PaymentStatus.CANCELLED]: [],
  };

  /**
   * Returns true if the transition is valid according to the payment lifecycle.
   *
   * This method is intentionally simple and deterministic.
   * It is suitable for a POC because it makes the rules transparent and easy to test.
   */
  static canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
    return (this.transitions[from] ?? []).includes(to);
  }

  /**
   * Enforces the lifecycle by throwing when an invalid transition is attempted.
   *
   * This keeps the domain invariant centralized and avoids repeating "if status != X"
   * checks in multiple service methods.
   */
  static assertCanTransition(from: PaymentStatus, to: PaymentStatus): void {
    if (!this.canTransition(from, to)) {
      throw new InvalidPaymentTransitionException(from, to);
    }
  }
}
