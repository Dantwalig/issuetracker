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
import { TeamsService } from './teams.service';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto } from './dto/team.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TeamLeadService } from '../common/team-lead.service';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly teamLeadService: TeamLeadService,
  ) {}

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateTeamDto, @CurrentUser() user: { id: string; role: string }) {
    return this.teamsService.create(dto, user.id);
  }

  @Get()
  findAll() {
    return this.teamsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.teamsService.remove(id);
  }

  @Post(':id/members')
  @UseGuards(AdminGuard)
  addMember(@Param('id') id: string, @Body() dto: AddTeamMemberDto) {
    return this.teamsService.addMember(id, dto.userId);
  }

  @Delete(':id/members/:userId')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.teamsService.removeMember(id, userId);
  }

  // ── Team Lead management (admin only) ──────────────────────────────────

  /** Promote a team member to Team Lead for this team. */
  @Post(':id/members/:userId/team-lead')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  promoteToTeamLead(
    @Param('id') teamId: string,
    @Param('userId') userId: string,
  ) {
    return this.teamLeadService.setTeamTeamLead(teamId, userId);
  }

  /** Revoke Team Lead role from a team member. */
  @Delete(':id/members/:userId/team-lead')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  revokeTeamLead(
    @Param('id') teamId: string,
    @Param('userId') userId: string,
  ) {
    return this.teamLeadService.removeTeamTeamLead(teamId, userId);
  }
}
