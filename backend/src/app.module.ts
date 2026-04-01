import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
})
export class AppModule {}
