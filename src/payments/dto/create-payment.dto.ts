import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { Currency } from '../enums/currency.enum';

export class CreatePaymentDto {
  @ApiProperty({ example: 125.5, description: 'Amount in the smallest supported currency unit.' })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: Currency, example: Currency.CAD })
  @IsEnum(Currency)
  currency!: Currency;

  @ApiPropertyOptional({ example: 'Order #12345' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    example: '7f5e4d2d-3a9a-4d51-a4f7-9b81d0c2e119',
    description: 'Client-generated idempotency key to prevent duplicate payment creation.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
