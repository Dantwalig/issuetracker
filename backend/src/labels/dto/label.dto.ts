import { IsString, IsNotEmpty, IsOptional, Matches, MaxLength } from 'class-validator';

export class CreateLabelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a valid hex color e.g. #6366f1' })
  color?: string;
}

export class UpdateLabelDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a valid hex color e.g. #6366f1' })
  color?: string;
}

export class AssignLabelDto {
  @IsString()
  @IsNotEmpty()
  labelId: string;
}
