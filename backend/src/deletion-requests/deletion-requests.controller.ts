import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { DeletionRequestsService } from './deletion-requests.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsString, MinLength, IsBoolean } from 'class-validator';

export class RequestDeleteDto {
  @IsString() @MinLength(1) reason: string;
}

export class RespondDto {
  @IsBoolean() approved: boolean;
  @IsString() @MinLength(1) responseReason: string;
}

@Controller('deletion-requests')
@UseGuards(JwtAuthGuard)
export class DeletionRequestsController {
  constructor(private readonly svc: DeletionRequestsService) {}

  @Post('issues/:issueId')
  requestDelete(
    @Param('issueId') issueId: string,
    @Body() dto: RequestDeleteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.svc.requestDelete(issueId, user.id, dto.reason);
  }

  @Get()
  listPending(@CurrentUser() user: { role: string }) {
    return this.svc.listPending(user.role);
  }

  @Post(':id/respond')
  respond(
    @Param('id') id: string,
    @Body() dto: RespondDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.respond(id, user.id, user.role, dto.approved, dto.responseReason);
  }
}
