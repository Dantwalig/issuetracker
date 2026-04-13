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
import { IssuesService } from './issues.service';
import { CreateIssueDto, UpdateIssueDto } from './dto/issue.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// ── Standard issue routes (auth required) ────────────────────────────────────
@Controller('projects/:projectId/issues')
@UseGuards(JwtAuthGuard)
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateIssueDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.issuesService.create({ ...dto, projectId }, user.id, user.role);
  }

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.issuesService.findByProject(projectId, user.id, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.issuesService.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIssueDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.issuesService.update(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.issuesService.remove(id, user.id, user.role);
  }
}

// ── Share token routes ────────────────────────────────────────────────────────
// POST   /issues/:id/share      → generate token (auth required)
// DELETE /issues/:id/share      → revoke token  (auth required)
// GET    /issues/share/:token   → public read   (NO auth)

@Controller('issues')
export class IssueShareController {
  constructor(private readonly issuesService: IssuesService) {}

  /** Generate or retrieve a share token (requires login). */
  @Post(':id/share')
  @UseGuards(JwtAuthGuard)
  generateShare(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.issuesService.generateShareToken(id, user.id, user.role);
  }

  /** Revoke share token (requires login). */
  @Delete(':id/share')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeShare(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.issuesService.revokeShareToken(id, user.id, user.role);
  }

  /** Public read by share token — NO auth guard. */
  @Get('share/:token')
  getByToken(@Param('token') token: string) {
    return this.issuesService.findByShareToken(token);
  }
}
