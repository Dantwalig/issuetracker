import { Controller, Get, Post, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { RecycleBinService } from './recycle-bin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsString, MinLength } from 'class-validator';

export class DeleteWithReasonDto {
  @IsString() @MinLength(1) reason: string;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class RecycleBinController {
  constructor(private readonly svc: RecycleBinService) {}

  @Get('recycle-bin')
  list(@CurrentUser() user: { id: string; role: string }) {
    return this.svc.list(user.id, user.role);
  }

  @Post('issues/:id/delete')
  @UseGuards(AdminGuard)
  deleteIssue(
    @Param('id') id: string,
    @Body() dto: DeleteWithReasonDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.softDeleteIssue(id, user.id, user.role, dto.reason);
  }

  @Post('projects/:id/delete')
  @UseGuards(AdminGuard)
  deleteProject(
    @Param('id') id: string,
    @Body() dto: DeleteWithReasonDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.softDeleteProject(id, user.id, user.role, dto.reason);
  }

  @Post('teams/:id/delete')
  @UseGuards(AdminGuard)
  deleteTeam(
    @Param('id') id: string,
    @Body() dto: DeleteWithReasonDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.softDeleteTeam(id, user.id, user.role, dto.reason);
  }

  @Post('recycle-bin/:id/restore')
  @UseGuards(AdminGuard)
  restore(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.restore(id, user.id, user.role);
  }

  @Delete('recycle-bin/:id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  hardDelete(@Param('id') id: string) {
    return this.svc.hardDelete(id);
  }
}
