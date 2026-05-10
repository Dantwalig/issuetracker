import { Global, Module } from '@nestjs/common';
import { TeamLeadService } from './team-lead.service';

@Global()
@Module({
  providers: [TeamLeadService],
  exports: [TeamLeadService],
})
export class TeamLeadModule {}
