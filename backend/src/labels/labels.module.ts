import { Module } from '@nestjs/common';
import { LabelsService } from './labels.service';
import { LabelsController, IssueLabelController } from './labels.controller';

@Module({
  providers: [LabelsService],
  controllers: [LabelsController, IssueLabelController],
  exports: [LabelsService],
})
export class LabelsModule {}
