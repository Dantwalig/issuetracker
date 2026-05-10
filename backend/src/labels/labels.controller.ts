import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { LabelsService } from './labels.service';
import { CreateLabelDto, UpdateLabelDto, AssignLabelDto } from './dto/label.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('projects/:projectId/labels')
@UseGuards(JwtAuthGuard)
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get()
  list(@Param('projectId') projectId: string, @CurrentUser() user: { id: string; role: string }) {
    return this.labelsService.listByProject(projectId, user.id, user.role);
  }

  @Post()
  create(@Param('projectId') projectId: string, @Body() dto: CreateLabelDto, @CurrentUser() user: { id: string; role: string }) {
    return this.labelsService.create(projectId, dto, user.id, user.role);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLabelDto, @CurrentUser() user: { id: string; role: string }) {
    return this.labelsService.update(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: { id: string; role: string }) {
    return this.labelsService.remove(id, user.id, user.role);
  }
}

@Controller('issues/:issueId/labels')
@UseGuards(JwtAuthGuard)
export class IssueLabelController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get()
  getLabels(@Param('issueId') issueId: string, @CurrentUser() user: { id: string; role: string }) {
    return this.labelsService.getIssueLabels(issueId, user.id, user.role);
  }

  @Post()
  addLabel(@Param('issueId') issueId: string, @Body() dto: AssignLabelDto, @CurrentUser() user: { id: string; role: string }) {
    return this.labelsService.addLabelToIssue(issueId, dto.labelId, user.id, user.role);
  }

  @Delete(':labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLabel(@Param('issueId') issueId: string, @Param('labelId') labelId: string, @CurrentUser() user: { id: string; role: string }) {
    return this.labelsService.removeLabelFromIssue(issueId, labelId, user.id, user.role);
  }
}
