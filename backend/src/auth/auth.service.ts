import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import {
  LoginDto,
  RefreshTokenDto,
  CreateUserDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateRoleDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import { Role } from '@prisma/client';

function generateTempPassword(length = 12): string {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: { sub: string; email: string };

    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new ForbiddenException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.refreshTokenHash || !user.isActive) {
      throw new ForbiddenException('Access denied');
    }

    const tokenMatch = await bcrypt.compare(
      dto.refreshToken,
      user.refreshTokenHash,
    );

    if (!tokenMatch) {
      throw new ForbiddenException('Access denied');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    return { message: 'Password updated successfully' };
  }

  async listUsers(callerId: string, callerRole: string) {
    if (callerRole === 'ADMIN' || callerRole === 'SUPERADMIN') {
      return this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { fullName: 'asc' },
      });
    }

    const memberships = await this.prisma.projectMember.findMany({
      where: { userId: callerId },
      select: { projectId: true },
    });
    const projectIds = memberships.map((m) => m.projectId);

    if (projectIds.length === 0) {
      return this.prisma.user.findMany({
        where: { id: callerId, isActive: true },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
    }

    return this.prisma.user.findMany({
      where: {
        isActive: true,
        projectMembers: { some: { projectId: { in: projectIds } } },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('A user with that email already exists');
    }

    // Always auto-generate a random temp password
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        passwordHash,
        role: dto.role ?? Role.MEMBER,
        mustChangePassword: true,
      },
    });

    // Fire-and-forget: send welcome email with temp password
    void this.emailService.sendWelcome({
      to: user.email,
      fullName: user.fullName,
      tempPassword,
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
    };
  }

  async updateRole(targetId: string, callerId: string, callerRole: string, dto: UpdateRoleDto) {
    if (targetId === callerId) {
      throw new ForbiddenException('You cannot change your own role');
    }
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user || !user.isActive) throw new NotFoundException('User not found');

    // Only SUPERADMIN can change another admin's role
    if (user.role === 'ADMIN' && callerRole !== 'SUPERADMIN') {
      throw new ForbiddenException('Only a superadmin can change another admin\'s role');
    }

    // Nobody can demote a SUPERADMIN via this endpoint
    if (user.role === 'SUPERADMIN') {
      throw new ForbiddenException('The superadmin role cannot be changed');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { role: dto.role as Role },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
    });
    return updated;
  }

  async hasSuperAdmin() {
    const count = await this.prisma.user.count({ where: { role: Role.SUPERADMIN } });
    return { exists: count > 0 };
  }

  async promoteSuperAdmin(targetId: string, callerId: string) {
    if (targetId === callerId) {
      throw new ForbiddenException('You cannot promote yourself to superadmin');
    }

    // Check no superadmin exists yet
    const existing = await this.prisma.user.findFirst({
      where: { role: Role.SUPERADMIN },
    });
    if (existing) {
      throw new ForbiddenException('A superadmin already exists — this action can only be done once');
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || !target.isActive) throw new NotFoundException('User not found');
    if (target.role !== Role.ADMIN) {
      throw new ForbiddenException('Only an admin can be promoted to superadmin');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { role: Role.SUPERADMIN },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
    });
    return updated;
  }

  async deactivateUser(targetId: string, callerId: string, callerRole: string) {
    if (targetId === callerId) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'SUPERADMIN') {
      throw new ForbiddenException('The superadmin account cannot be deactivated');
    }
    if (user.role === 'ADMIN' && callerRole !== 'SUPERADMIN') {
      throw new ForbiddenException('Only a superadmin can deactivate another admin');
    }
    if (!user.isActive) throw new BadRequestException('User is already deactivated');

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { isActive: false, refreshTokenHash: null },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
    });
    return updated;
  }

  async reactivateUser(targetId: string, callerId: string) {
    if (targetId === callerId) {
      throw new ForbiddenException('You cannot reactivate your own account');
    }
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.isActive) throw new BadRequestException('User is already active');

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { isActive: true },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
    });
    return updated;
  }

  async deleteUser(targetId: string, callerId: string, callerRole: string) {
    if (targetId === callerId) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'SUPERADMIN') {
      throw new ForbiddenException('The superadmin account cannot be deleted');
    }
    if (user.role === 'ADMIN' && callerRole !== 'SUPERADMIN') {
      throw new ForbiddenException('Only a superadmin can delete another admin');
    }

    // Resolve all FK constraints before deleting the user.
    // Cascade relations (TeamMember, ProjectMember, Notification) are handled by the DB.
    // Non-cascade relations must be cleaned up manually:

    // 1. Issues where user is the assignee — nullify (optional field)
    await this.prisma.issue.updateMany({
      where: { assigneeId: targetId },
      data: { assigneeId: null },
    });

    // 2. Issues where user is the reporter — reassign to a system placeholder or delete
    //    Deleting reported issues also cascades their comments, so this is safe.
    await this.prisma.issue.deleteMany({
      where: { reporterId: targetId },
    });

    // 3. Comments authored by this user on issues they did NOT report
    //    (issues they reported were already deleted above)
    await this.prisma.comment.deleteMany({
      where: { authorId: targetId },
    });

    await this.prisma.user.delete({ where: { id: targetId } });
    return { message: 'User permanently deleted' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    // Always respond with success to prevent email enumeration
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (user && user.isActive) {
      const token = require('crypto').randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: token, passwordResetExpiry: expiry },
      });

      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
      const resetLink = `${frontendUrl}/reset-password?token=${token}`;

      void this.emailService.sendPasswordReset({
        to: user.email,
        fullName: user.fullName,
        resetLink,
      });
    }

    return {
      message:
        'If that email is registered, you will receive a password reset link shortly.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpiry: { gt: new Date() },
        isActive: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset link.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
        mustChangePassword: false,
        // Invalidate any active refresh tokens too
        refreshTokenHash: null,
      },
    });

    return { message: 'Password reset successfully. You can now sign in.' };
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn:
          this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, token: string) {
    const hash = await bcrypt.hash(token, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: any = {};
    if (dto.fullName) data.fullName = dto.fullName;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, fullName: true, role: true, avatarUrl: true, isActive: true, mustChangePassword: true },
    });
  }
}
