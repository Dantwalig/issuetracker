import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { GroupChatService } from './group-chat.service';
import {
  CreateGroupDto,
  SendGroupMessageDto,
  EditMessageDto,
  InviteToGroupDto,
  ApproveInviteDto,
} from './dto/group.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupChatController {
  constructor(private readonly groupChatService: GroupChatService) {}

  // ── Groups ──────────────────────────────────────────────────────────────

  @Post()
  createGroup(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateGroupDto,
  ) {
    return this.groupChatService.createGroup(user.id, dto);
  }

  @Get()
  listGroups(@CurrentUser() user: { id: string }) {
    return this.groupChatService.listGroups(user.id);
  }

  @Get(':groupId')
  getGroup(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
  ) {
    return this.groupChatService.getGroup(groupId, user.id);
  }

  // ── Messages ─────────────────────────────────────────────────────────────

  @Get(':groupId/messages')
  getMessages(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
  ) {
    return this.groupChatService.getMessages(groupId, user.id);
  }

  @Post(':groupId/messages')
  sendMessage(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Body() dto: SendGroupMessageDto,
  ) {
    return this.groupChatService.sendMessage(groupId, user.id, dto);
  }

  @Patch('messages/:messageId')
  editMessage(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.groupChatService.editMessage(messageId, user.id, dto);
  }

  @Delete('messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMessage(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
  ) {
    return this.groupChatService.deleteGroupMessage(messageId, user.id);
  }

  // ── Invite / add-member flow ─────────────────────────────────────────────

  @Post(':groupId/invite')
  requestInvite(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Body() dto: InviteToGroupDto,
  ) {
    return this.groupChatService.requestInvite(groupId, user.id, dto);
  }

  @Get(':groupId/invites')
  getPendingInvites(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
  ) {
    return this.groupChatService.getPendingInviteRequests(groupId, user.id);
  }

  @Post('invites/:requestId/respond')
  respondToInvite(
    @CurrentUser() user: { id: string },
    @Param('requestId') requestId: string,
    @Body() dto: ApproveInviteDto,
  ) {
    return this.groupChatService.respondToInvite(requestId, user.id, dto.decision, dto.reason);
  }

  @Delete('invites/:requestId')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelInvite(
    @CurrentUser() user: { id: string },
    @Param('requestId') requestId: string,
  ) {
    return this.groupChatService.cancelInvite(requestId, user.id);
  }
}
