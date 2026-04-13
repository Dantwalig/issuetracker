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
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, AddProjectMemberDto } from './dto/project.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TeamLeadService } from '../common/team-lead.service';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly teamLeadService: TeamLeadService,
  ) {}

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: { id: string; role: string }) {
    return this.projectsService.create(dto, user.id);
  }

  @Get()
  findAll(@CurrentUser() user: { id: string; role: string }) {
    return this.projectsService.findAll(user.id, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string; role: string }) {
    return this.projectsService.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.projectsService.update(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  @Post(':id/members')
  @UseGuards(AdminGuard)
  addMember(
    @Param('id') id: string,
    @Body() dto: AddProjectMemberDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.projectsService.addMember(id, dto.userId, user.id, user.role);
  }

  @Delete(':id/members/:userId')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.projectsService.removeMember(id, userId, user.id, user.role);
  }

  // ── Team Lead management (admin only) ──────────────────────────────────

  /** Promote a project member to Team Lead for this project. */
  @Post(':id/members/:userId/team-lead')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  promoteToTeamLead(
    @Param('id') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.teamLeadService.setProjectTeamLead(projectId, userId);
  }

  /** Revoke Team Lead role from a project member. */
  @Delete(':id/members/:userId/team-lead')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  revokeTeamLead(
    @Param('id') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.teamLeadService.removeProjectTeamLead(projectId, userId);
  }
}


@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: { id: string; role: string }) {
    return this.projectsService.create(dto, user.id);
  }

  @Get()
  findAll(@CurrentUser() user: { id: string; role: string }) {
    return this.projectsService.findAll(user.id, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string; role: string }) {
    return this.projectsService.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.projectsService.update(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  @Post(':id/members')
  @UseGuards(AdminGuard)
  addMember(
    @Param('id') id: string,
    @Body() dto: AddProjectMemberDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.projectsService.addMember(id, dto.userId, user.id, user.role);
  }

  @Delete(':id/members/:userId')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.projectsService.removeMember(id, userId, user.id, user.role);
  }
}
