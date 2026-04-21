import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/message.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  listConversations(@CurrentUser() user: { id: string }) {
    return this.messagesService.listConversations(user.id);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: { id: string }) {
    return this.messagesService.unreadCount(user.id);
  }

  @Get('conversations/:partnerId')
  getConversation(
    @CurrentUser() user: { id: string },
    @Param('partnerId') partnerId: string,
  ) {
    return this.messagesService.getConversation(user.id, partnerId);
  }

  @Post('conversations/:partnerId')
  sendMessage(
    @CurrentUser() user: { id: string },
    @Param('partnerId') partnerId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.sendMessage(user.id, partnerId, dto);
  }

  @Patch(':id')
  editMessage(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body('body') body: string,
  ) {
    return this.messagesService.editMessage(id, user.id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMessage(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.messagesService.deleteMessage(id, user.id);
  }
}
