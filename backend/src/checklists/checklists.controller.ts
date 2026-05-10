import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ChecklistsService } from './checklists.service';
import {
  CreateChecklistDto,
  UpdateChecklistDto,
  CreateChecklistItemDto,
  UpdateChecklistItemDto,
} from './dto/checklist.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// ── Checklist routes (scoped to an issue) ──────────────────────────────────
// GET    /issues/:issueId/checklists
// POST   /issues/:issueId/checklists
// PATCH  /issues/:issueId/checklists/:id
// DELETE /issues/:issueId/checklists/:id

@Controller('issues/:issueId/checklists')
@UseGuards(JwtAuthGuard)
export class ChecklistsController {
  constructor(private readonly svc: ChecklistsService) {}

  @Get()
  list(
    @Param('issueId') issueId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.listByIssue(issueId, user.id, user.role);
  }

  @Post()
  create(
    @Param('issueId') issueId: string,
    @Body() dto: CreateChecklistDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.createChecklist(issueId, dto, user.id, user.role);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateChecklistDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.updateChecklist(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.deleteChecklist(id, user.id, user.role);
  }
}

// ── Checklist item routes ───────────────────────────────────────────────────
// POST   /checklists/:checklistId/items
// PATCH  /checklists/:checklistId/items/:itemId
// DELETE /checklists/:checklistId/items/:itemId

@Controller('checklists/:checklistId/items')
@UseGuards(JwtAuthGuard)
export class ChecklistItemsController {
  constructor(private readonly svc: ChecklistsService) {}

  @Post()
  create(
    @Param('checklistId') checklistId: string,
    @Body() dto: CreateChecklistItemDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.createItem(checklistId, dto, user.id, user.role);
  }

  @Patch(':itemId')
  update(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateChecklistItemDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.updateItem(itemId, dto, user.id, user.role);
  }

  @Delete(':itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('itemId') itemId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.deleteItem(itemId, user.id, user.role);
  }
}
