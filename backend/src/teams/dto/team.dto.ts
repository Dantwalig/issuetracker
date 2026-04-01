import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateTeamDto extends PartialType(CreateTeamDto) {}

export class AddTeamMemberDto {
  @IsString()
  userId: string;
}
