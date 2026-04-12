import { Module } from '@nestjs/common';
import { DeletionRequestsService } from './deletion-requests.service';
import { DeletionRequestsController } from './deletion-requests.controller';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RecycleBinModule } from '../recycle-bin/recycle-bin.module';

@Module({
  imports: [EmailModule, NotificationsModule, RecycleBinModule],
  controllers: [DeletionRequestsController],
  providers: [DeletionRequestsService],
})
export class DeletionRequestsModule {}
