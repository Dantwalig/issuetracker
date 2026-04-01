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
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('issues/:issueId/comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  create(
    @Param('issueId') issueId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.commentsService.create(issueId, dto, user.id, user.role);
  }

  @Get()
  findAll(
    @Param('issueId') issueId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.commentsService.findByIssue(issueId, user.id, user.role);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.commentsService.update(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.commentsService.remove(id, user.id, user.role);
  }
}
