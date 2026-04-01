import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Ensures the caller is either an ADMIN or a member of the project
 * identified by :projectId or :id in the route params.
 */
@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException('Not authenticated');
    if (user.role === 'ADMIN') return true;

    const projectId = req.params.projectId ?? req.params.id;
    if (!projectId) return true; // no project param – skip

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this project');
    }
    return true;
  }
}
