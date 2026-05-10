import { Module } from '@nestjs/common';
import { LabelsService } from './labels.service';
import { LabelsController, IssueLabelController } from './labels.controller';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [ActivityModule],
  providers: [LabelsService],
  controllers: [LabelsController, IssueLabelController],
  exports: [LabelsService],
})
export class LabelsModule {}
