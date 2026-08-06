import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { RefreshTokenService } from 'src/auth/refresh-token.service';
import {
  ADMIN_ROLES,
  isAdminRole,
  isSuperAdminRole,
  Role,
} from 'src/constants/role.enum';
import { MIN_PASSWORD_LENGTH } from 'src/constants/password.constants';
import { AdminDeactivatedDTO, AdminListDTO } from './dto/adminListDTO';
import { AdminCreatedDTO, CreateAdminDTO } from './dto/createAdminDTO';

@Injectable()
export class AdminService {
  constructor(
    private readonly userService: UserService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /**
   * Creates a brand-new administrator.
   *
   * Administrators are never promoted buyers: an account is created as an admin
   * here (or by the `admin:create` CLI script, which bootstraps the first super
   * admin) or it is a buyer for life. That keeps the two populations separate —
   * buyers arrive through public self-registration, administrators only ever by
   * a super admin's deliberate act.
   */
  async createAdmin(dto: CreateAdminDTO): Promise<AdminCreatedDTO> {
    const userName = dto.userName?.trim();
    const email = dto.email?.trim().toLowerCase();
    const role = dto.role ?? Role.Admin;

    if (!userName || !email || !dto.password) {
      throw new BadRequestException(
        'userName, email and password are required.',
      );
    }

    if (dto.password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }

    // Buyers are deliberately not creatable here — that is what public
    // registration is for, and allowing it would blur the two paths.
    if (!ADMIN_ROLES.includes(role)) {
      throw new BadRequestException(
        `role must be one of: ${ADMIN_ROLES.join(', ')}`,
      );
    }

    // Checked up front so a clash is a readable 409 rather than a unique
    // constraint violation surfacing as a 500.
    const clash = await this.userService.findByUsernameOrEmail(userName, email);
    if (clash) {
      throw new ConflictException(
        clash.userName === userName
          ? `The username "${userName}" is already taken.`
          : `The email "${email}" already belongs to another account.`,
      );
    }

    // Saved through the repository so the entity's @BeforeInsert() hook hashes
    // the password with the same bcrypt cost the login path verifies against.
    const created = await this.userService.createAdmin({
      userName,
      email,
      password: dto.password,
      firstName: dto.firstName ?? null,
      lastName: dto.lastName ?? null,
      phoneNumber: dto.phoneNumber ?? null,
      role: role as Role,
    });

    return {
      id: created.id,
      userName: created.userName,
      email: created.email,
      firstName: created.firstName,
      lastName: created.lastName,
      role: created.role,
      isActive: created.isActive,
      createdAt: created.createdAt,
    };
  }

  /** Every admin and super admin, including deactivated ones. */
  async listAdmins(): Promise<AdminListDTO> {
    const admins = await this.userService.findAdmins();

    return {
      admins: admins.map((user) => ({
        id: user.id,
        userName: user.userName,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      })),
      total: admins.length,
    };
  }

  /**
   * Deactivates an administrator: the account and its role stay, but it can no
   * longer sign in, and every existing session is ended. Reversible by an
   * `is_active` update — there is no reactivation endpoint yet.
   *
   * Chosen over deleting the row because `orders.user_id` is `ON DELETE
   * RESTRICT`, so a hard delete fails for anyone who has ever ordered.
   */
  async deactivateAdmin(
    actorUserId: number,
    targetUserId: number,
  ): Promise<AdminDeactivatedDTO> {
    if (actorUserId === targetUserId) {
      throw new ForbiddenException('You cannot deactivate your own account.');
    }

    const target = await this.userService.findUserById(targetUserId);
    if (!target) {
      throw new NotFoundException(`No user with id ${targetUserId}`);
    }

    // This endpoint manages administrators only; a buyer is not "an admin to
    // delete", and silently deactivating one would be a surprising side effect.
    if (!isAdminRole(target.role)) {
      throw new BadRequestException(
        `User ${targetUserId} is a ${target.role}, not an administrator.`,
      );
    }

    if (!target.isActive) {
      throw new ConflictException('That administrator is already deactivated.');
    }

    if (
      isSuperAdminRole(target.role) &&
      (await this.userService.countActiveByRole(Role.SuperAdmin)) <= 1
    ) {
      throw new ConflictException(
        'This is the only active super admin; create another one first.',
      );
    }

    await this.userService.setActive(targetUserId, false);

    // The access token already issued says nothing about is_active, so ending
    // the refresh families is what actually locks them out — otherwise they
    // keep working until the access token expires and can renew before then.
    const sessionsRevoked =
      await this.refreshTokenService.revokeAllForUser(targetUserId);

    return {
      id: target.id,
      userName: target.userName,
      email: target.email,
      role: target.role,
      isActive: false,
      sessionsRevoked,
    };
  }
}
