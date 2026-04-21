import { Module } from '@nestjs/common';
import { DeadlineService } from './deadline.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [DeadlineService],
})
export class DeadlineModule {}
