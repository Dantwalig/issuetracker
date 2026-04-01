import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { BacklogService } from './backlog.service';
import { ReorderBacklogDto, MoveIssueDto } from './dto/backlog.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('projects/:projectId/backlog')
@UseGuards(JwtAuthGuard)
export class BacklogController {
  constructor(private readonly backlogService: BacklogService) {}

  /** GET /projects/:projectId/backlog — list backlog issues in order */
  @Get()
  listBacklog(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.backlogService.listBacklog(projectId, user.id, user.role);
  }

  /** PATCH /projects/:projectId/backlog/reorder — reorder the entire backlog */
  @Patch('reorder')
  reorder(
    @Param('projectId') projectId: string,
    @Body() dto: ReorderBacklogDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.backlogService.reorder(projectId, dto, user.id, user.role);
  }

  /**
   * PATCH /projects/:projectId/backlog/:issueId/move
   * Move an issue into or out of the backlog.
   * Body: { sprintId: null } → backlog
   * Body: { sprintId: "<id>" } → sprint (future use)
   */
  @Patch(':issueId/move')
  moveIssue(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() dto: MoveIssueDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.backlogService.moveIssue(projectId, issueId, dto, user.id, user.role);
  }
}
