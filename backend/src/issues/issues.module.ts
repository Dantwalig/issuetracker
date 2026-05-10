import { Module } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { IssuesController, IssueShareController } from './issues.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [NotificationsModule, ActivityModule],
  providers: [IssuesService],
  controllers: [IssuesController, IssueShareController],
})
export class IssuesModule {}
