import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { Payment } from './models/payment.model';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create and asynchronously process a payment' })
  create(@Body() dto: CreatePaymentDto): Promise<Payment> {
    return this.service.create(dto);
  }

  @Get()
  findAll(): Promise<Payment[]> {
    return this.service.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string): Promise<Payment> {
    return this.service.findById(id);
  }

  @Patch(':id/status')
  @HttpCode(200)
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePaymentStatusDto): Promise<Payment> {
    return this.service.updateStatus(id, dto);
  }
}
