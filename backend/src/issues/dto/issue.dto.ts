import { IsString, IsOptional, IsEnum, IsInt, IsDateString, MinLength, MaxLength, Min } from 'class-validator';
import { IssueType, IssueStatus, IssuePriority } from '@prisma/client';
import { PartialType, OmitType } from '@nestjs/mapped-types';

export class CreateIssueDto {
  @IsString() @MinLength(3) @MaxLength(255)
  title: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @IsOptional() @IsEnum(IssueType)
  type?: IssueType;

  @IsOptional() @IsEnum(IssueStatus)
  status?: IssueStatus;

  @IsOptional() @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @IsOptional() @IsInt() @Min(1)
  storyPoints?: number;

  @IsOptional() @IsDateString()
  deadline?: string;

  @IsOptional() @IsString()
  assigneeId?: string;

  @IsOptional() @IsString()
  projectId?: string;
}

export class UpdateIssueDto extends PartialType(OmitType(CreateIssueDto, ['projectId'] as const)) {}
