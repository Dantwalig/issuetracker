import { IsString, IsNotEmpty, IsArray, ArrayMinSize, MinLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  /** IDs of the other members to add (not including creator) */
  @IsArray()
  @ArrayMinSize(1)
  memberIds: string[];
}

export class SendGroupMessageDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  body: string;
}

export class EditMessageDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  body: string;
}

export class InviteToGroupDto {
  @IsString()
  @IsNotEmpty()
  inviteeId: string;
}

export class ApproveInviteDto {
  @IsString()
  @IsNotEmpty()
  decision: 'approve' | 'reject';

  @IsString()
  reason?: string;
}
