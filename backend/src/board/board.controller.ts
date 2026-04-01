import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { BoardService } from './board.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsEnum } from 'class-validator';
import { IssueStatus } from '@prisma/client';

class UpdateIssueStatusDto {
  @IsEnum(IssueStatus)
  status: IssueStatus;
}

@Controller('projects/:projectId/board')
@UseGuards(JwtAuthGuard)
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  /** GET /projects/:projectId/board */
  @Get()
  getBoard(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.boardService.getBoard(projectId, user.id, user.role);
  }

  /** PATCH /projects/:projectId/board/issues/:issueId/status */
  @Patch('issues/:issueId/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() dto: UpdateIssueStatusDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.boardService.updateIssueStatus(
      projectId,
      issueId,
      dto.status,
      user.id,
      user.role,
    );
  }
}
