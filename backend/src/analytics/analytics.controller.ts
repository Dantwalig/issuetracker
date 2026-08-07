import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('projects/:projectId/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /** GET /projects/:projectId/analytics/velocity */
  @Get('velocity')
  getVelocity(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.analyticsService.getVelocity(projectId, user.id, user.role);
  }

  /** GET /projects/:projectId/analytics/burndown?sprintId=… */
  @Get('burndown')
  getBurndown(
    @Param('projectId') projectId: string,
    @Query('sprintId') sprintId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.analyticsService.getBurndown(projectId, sprintId, user.id, user.role);
  }

  /** GET /projects/:projectId/analytics/workload */
  @Get('workload')
  getWorkload(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.analyticsService.getWorkload(projectId, user.id, user.role);
  }
}
