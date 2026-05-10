import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class AttachmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName: string;

  /** base64-encoded file contents */
  @IsString()
  @MinLength(1)
  fileData: string;

  /** MIME type — must be image/* or application/pdf */
  @IsString()
  mimeType: string;

  /** file size in bytes — max 2 MB = 2_097_152 */
  @IsInt()
  @Min(1)
  @Max(2_097_152)
  fileSize: number;
}

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  /** user IDs explicitly mentioned via @mention in the comment body */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentionedUserIds?: string[];
}

export class UpdateCommentDto extends PartialType(CreateCommentDto) {}
