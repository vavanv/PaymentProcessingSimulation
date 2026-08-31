import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PaymentStatus } from '../enums/payment-status.enum';

export class UpdatePaymentStatusDto {
  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.CANCELLED })
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;
}
