import { Module } from '@nestjs/common';
import { RecycleBinService } from './recycle-bin.service';
import { RecycleBinController } from './recycle-bin.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [RecycleBinController],
  providers: [RecycleBinService],
  exports: [RecycleBinService],
})
export class RecycleBinModule {}
