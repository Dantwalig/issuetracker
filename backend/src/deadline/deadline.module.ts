import { Module } from '@nestjs/common';
import { DeadlineService } from './deadline.service';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EmailModule, NotificationsModule],
  providers: [DeadlineService],
})
export class DeadlineModule {}
