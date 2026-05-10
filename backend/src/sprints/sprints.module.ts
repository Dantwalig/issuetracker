import { Module } from '@nestjs/common';
import { SprintsController } from './sprints.controller';
import { SprintsService } from './sprints.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [PrismaModule, NotificationsModule, ActivityModule],
  controllers: [SprintsController],
  providers: [SprintsService],
  exports: [SprintsService],
})
export class SprintsModule {}
