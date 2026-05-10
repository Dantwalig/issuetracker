import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { SuperAdminGuard } from '../common/guards/superadmin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() user: { id: string }) {
    return this.authService.logout(user.id);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: { id: string }) {
    return this.authService.getMe(user.id);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  listUsers(@CurrentUser() user: { id: string; role: string }) {
    return this.authService.listUsers(user.id, user.role);
  }

  @Post('users')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  // Check whether a superadmin already exists (used by the frontend to show/hide the promote button)
  @Get('superadmin/exists')
  @UseGuards(JwtAuthGuard, AdminGuard)
  hasSuperAdmin() {
    return this.authService.hasSuperAdmin();
  }

  // One-time promotion — only an ADMIN can call this, and only if no superadmin exists yet
  @Post('users/:id/promote-superadmin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  promoteSuperAdmin(
    @Param('id') targetId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.authService.promoteSuperAdmin(targetId, user.id);
  }

  // Role change — SUPERADMIN can change admin roles, ADMIN can only change member roles
  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  updateRole(
    @Param('id') targetId: string,
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: UpdateRoleDto,
  ) {
    return this.authService.updateRole(targetId, user.id, user.role, dto);
  }

  @Patch('users/:id/deactivate')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  deactivateUser(
    @Param('id') targetId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.authService.deactivateUser(targetId, user.id, user.role);
  }

  @Patch('users/:id/reactivate')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  reactivateUser(
    @Param('id') targetId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.authService.reactivateUser(targetId, user.id);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  deleteUser(
    @Param('id') targetId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.authService.deleteUser(targetId, user.id, user.role);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, dto);
  }
}
