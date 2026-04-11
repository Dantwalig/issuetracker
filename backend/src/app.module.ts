import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { IssuesModule } from './issues/issues.module';
import { TeamsModule } from './teams/teams.module';
import { ProjectsModule } from './projects/projects.module';
import { SprintsModule } from './sprints/sprints.module';
import { BacklogModule } from './backlog/backlog.module';
import { BoardModule } from './board/board.module';
import { CommentsModule } from './comments/comments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RecycleBinModule } from './recycle-bin/recycle-bin.module';
import { DeletionRequestsModule } from './deletion-requests/deletion-requests.module';
import { DeadlineModule } from './deadline/deadline.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    IssuesModule,
    TeamsModule,
    ProjectsModule,
    SprintsModule,
    BacklogModule,
    BoardModule,
    CommentsModule,
    NotificationsModule,
    RecycleBinModule,
    DeletionRequestsModule,
    DeadlineModule,
  ],
})
export class AppModule {}
