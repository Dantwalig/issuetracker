import { IsString, IsOptional, IsEnum, IsInt, IsDateString, MinLength, MaxLength, Min, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { IssueType, IssueStatus, IssuePriority } from '@prisma/client';
import { OmitType } from '@nestjs/mapped-types';

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

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined || value === null ? undefined : Number(value)))
  @IsInt() @Min(1)
  storyPoints?: number;

  @IsOptional() @IsDateString()
  deadline?: string;

  @IsOptional() @IsString()
  assigneeId?: string;

  @IsOptional() @IsString()
  projectId?: string;
}

/**
 * UpdateIssueDto is a manual partial so we can allow deadline: null (to clear it)
 * and storyPoints: null (to clear it), which PartialType cannot express cleanly.
 */
export class UpdateIssueDto extends OmitType(CreateIssueDto, ['projectId', 'title', 'deadline', 'storyPoints'] as const) {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(255)
  title?: string;

  /** null clears the deadline; a date string sets it; undefined leaves it unchanged */
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsDateString()
  deadline?: string | null;

  /** null clears story points; a number sets them; undefined leaves unchanged */
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @Transform(({ value }) => (value === '' || value === undefined ? undefined : value === null ? null : Number(value)))
  @IsInt() @Min(1)
  storyPoints?: number | null;
}
