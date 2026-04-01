import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { BacklogService } from './backlog.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsArray, IsString, IsOptional } from 'class-validator';

class ReorderBacklogDto {
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}

class MoveIssueDto {
  @IsOptional()
  @IsString()
  sprintId: string | null;
}

@Controller('projects/:projectId/backlog')
@UseGuards(JwtAuthGuard)
export class BacklogController {
  constructor(private readonly backlogService: BacklogService) {}

  /** GET /projects/:projectId/backlog */
  @Get()
  list(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.backlogService.list(projectId, user.id, user.role);
  }

  /** PATCH /projects/:projectId/backlog/reorder */
  @Patch('reorder')
  @HttpCode(HttpStatus.OK)
  reorder(
    @Param('projectId') projectId: string,
    @Body() dto: ReorderBacklogDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.backlogService.reorder(projectId, dto.orderedIds, user.id, user.role);
  }

  /** PATCH /projects/:projectId/backlog/:issueId/move */
  @Patch(':issueId/move')
  @HttpCode(HttpStatus.OK)
  moveIssue(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() dto: MoveIssueDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.backlogService.moveIssue(
      projectId,
      issueId,
      dto.sprintId ?? null,
      user.id,
      user.role,
    );
  }
}
