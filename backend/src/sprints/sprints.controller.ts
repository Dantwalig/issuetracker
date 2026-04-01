import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SprintsService } from './sprints.service';
import { CreateSprintDto, UpdateSprintDto } from './dto/sprint.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('projects/:projectId/sprints')
@UseGuards(JwtAuthGuard)
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  // ── Sprint CRUD ────────────────────────────────────────────────────────────

  /** POST /projects/:projectId/sprints */
  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateSprintDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.sprintsService.create(projectId, dto, user.id, user.role);
  }

  /** GET /projects/:projectId/sprints */
  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.sprintsService.findByProject(projectId, user.id, user.role);
  }

  /** GET /projects/:projectId/sprints/:sprintId */
  @Get(':sprintId')
  findOne(
    @Param('sprintId') sprintId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.sprintsService.findOne(sprintId, user.id, user.role);
  }

  /** PATCH /projects/:projectId/sprints/:sprintId */
  @Patch(':sprintId')
  update(
    @Param('sprintId') sprintId: string,
    @Body() dto: UpdateSprintDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.sprintsService.update(sprintId, dto, user.id, user.role);
  }

  /** DELETE /projects/:projectId/sprints/:sprintId */
  @Delete(':sprintId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSprint(
    @Param('sprintId') sprintId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.sprintsService.deleteSprint(sprintId, user.id, user.role);
  }

  // ── Transitions ────────────────────────────────────────────────────────────

  /** POST /projects/:projectId/sprints/:sprintId/start */
  @Post(':sprintId/start')
  @HttpCode(HttpStatus.OK)
  startSprint(
    @Param('sprintId') sprintId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.sprintsService.startSprint(sprintId, user.id, user.role);
  }

  /** POST /projects/:projectId/sprints/:sprintId/complete */
  @Post(':sprintId/complete')
  @HttpCode(HttpStatus.OK)
  completeSprint(
    @Param('sprintId') sprintId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.sprintsService.completeSprint(sprintId, user.id, user.role);
  }

  // ── Sprint issues ──────────────────────────────────────────────────────────

  /** GET /projects/:projectId/sprints/:sprintId/issues */
  @Get(':sprintId/issues')
  getIssues(
    @Param('sprintId') sprintId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.sprintsService.getSprintIssues(sprintId, user.id, user.role);
  }

  /** POST /projects/:projectId/sprints/:sprintId/issues/:issueId */
  @Post(':sprintId/issues/:issueId')
  @HttpCode(HttpStatus.OK)
  addIssue(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @Param('issueId') issueId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.sprintsService.addIssueToSprint(
      projectId,
      sprintId,
      issueId,
      user.id,
      user.role,
    );
  }

  /** DELETE /projects/:projectId/sprints/:sprintId/issues/:issueId */
  @Delete(':sprintId/issues/:issueId')
  @HttpCode(HttpStatus.OK)
  removeIssue(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.sprintsService.removeIssueFromSprint(
      projectId,
      issueId,
      user.id,
      user.role,
    );
  }
}
