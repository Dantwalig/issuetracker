import { Controller, Get, UseGuards } from '@nestjs/common';
import { MyWorkService } from './my-work.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('my-work')
@UseGuards(JwtAuthGuard)
export class MyWorkController {
  constructor(private readonly svc: MyWorkService) {}

  @Get()
  getDashboard(@CurrentUser() user: { id: string }) {
    return this.svc.getDashboard(user.id);
  }
}
