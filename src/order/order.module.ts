import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from 'src/catalog/catalog.module';
import { Order } from './model/order.entity';
import { OrderItem } from './model/order-item.entity';
import { PaymentAttempt } from './model/payment-attempt.entity';
import { StockMovement } from './model/stock-movement.entity';
import { OrderService } from './order.service';
import { StockService } from './stock.service';

@Module({
  imports: [
    CatalogModule,
    TypeOrmModule.forFeature([Order, OrderItem, PaymentAttempt, StockMovement]),
  ],
  providers: [OrderService, StockService],
  exports: [OrderService, StockService],
})
export class OrderModule {}
