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
}
