import {
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { IssueType, IssueStatus, IssuePriority } from '@prisma/client';
import { PartialType, OmitType } from '@nestjs/mapped-types';

export class CreateIssueDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsString()
  projectId: string;
}

// projectId is set from the route param, never from the request body on updates
export class UpdateIssueDto extends PartialType(OmitType(CreateIssueDto, ['projectId'] as const)) {}
