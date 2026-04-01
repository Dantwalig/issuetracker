import {
  Controller,
  Get,
  Patch,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** List last 50 notifications for the current user */
  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.notificationsService.listForUser(user.id);
  }

  /** Unread count — lightweight poll endpoint */
  @Get('unread-count')
  unreadCount(@CurrentUser() user: { id: string }) {
    return this.notificationsService
      .unreadCountForUser(user.id)
      .then((count) => ({ count }));
  }

  /** Mark a single notification as read */
  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markOneRead(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.notificationsService.markOneRead(id, user.id);
  }

  /** Mark all notifications as read */
  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@CurrentUser() user: { id: string }) {
    return this.notificationsService.markAllRead(user.id);
  }
}
