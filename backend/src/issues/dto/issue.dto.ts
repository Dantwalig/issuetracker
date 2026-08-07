import { IsString, IsOptional, IsEnum, IsInt, IsDateString, MinLength, MaxLength, Min, Max, IsIn, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { IssueType, IssueStatus, IssuePriority } from '@prisma/client';
import { OmitType } from '@nestjs/mapped-types';

/** Team-agreed estimation scale — planning guardrail (Sprint A, Task 6). */
export const STORY_POINT_SCALE = [1, 2, 3, 5, 8, 13] as const;
export type StoryPoint = (typeof STORY_POINT_SCALE)[number];

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
  @IsIn(STORY_POINT_SCALE, { message: 'storyPoints must be one of 1, 2, 3, 5, 8, 13' })
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

  /** null clears story points; a number sets them; undefined leaves unchanged.
   *  UPDATE is intentionally permissive (any positive int ≤ 100): prod already
   *  holds legacy non-Fibonacci values (10, 9, 4, 6, 12, 14, 18…) that must
   *  stay editable. CREATE enforces the Fibonacci scale via CreateIssueDto. */
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @Transform(({ value }) => (value === '' || value === undefined ? undefined : value === null ? null : Number(value)))
  @IsInt() @Min(1) @Max(100)
  storyPoints?: number | null;
}
