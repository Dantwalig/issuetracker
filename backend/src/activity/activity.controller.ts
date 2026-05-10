import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActivityService } from './activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

@Controller('projects/:projectId/activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getActivity(
    @Param('projectId') projectId: string,
    @Query('take') take: string,
    @Query('cursor') cursor: string,
    @Req() req: any,
  ) {
    // Verify the requesting user is a member of the project
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.user.id } },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this project');
    }

    return this.activityService.getProjectActivity(
      projectId,
      take ? Math.min(parseInt(take, 10), 100) : 30,
      cursor || undefined,
    );
  }
}
