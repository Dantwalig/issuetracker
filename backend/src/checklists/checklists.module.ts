import { Module } from '@nestjs/common';
import { ChecklistsService } from './checklists.service';
import {
  ChecklistsController,
  ChecklistItemsController,
} from './checklists.controller';

@Module({
  providers: [ChecklistsService],
  controllers: [ChecklistsController, ChecklistItemsController],
})
export class ChecklistsModule {}
