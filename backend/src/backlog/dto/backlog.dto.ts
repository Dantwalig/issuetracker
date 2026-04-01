import { IsString, IsArray, IsOptional } from 'class-validator';

/**
 * Reorder backlog: supply all issue IDs for the project in the desired order.
 * The service will assign backlogOrder = index position.
 */
export class ReorderBacklogDto {
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}

/**
 * Move an issue into or out of the backlog.
 * Pass sprintId: null to move to backlog, or a sprintId string to move into a sprint.
 * (Sprint support is a no-op for now — sprintId is stored but not validated against a sprint table.)
 */
export class MoveIssueDto {
  @IsOptional()
  @IsString()
  sprintId: string | null;
}
