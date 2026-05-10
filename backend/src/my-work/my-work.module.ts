import { Module } from '@nestjs/common';
import { MyWorkService } from './my-work.service';
import { MyWorkController } from './my-work.controller';

@Module({
  controllers: [MyWorkController],
  providers: [MyWorkService],
})
export class MyWorkModule {}
