import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from 'src/roles/roles.decorator';
import { Role } from 'src/constants/role.enum';
import { AuthenticatedRequest } from './authenticated-request';

/**
 * Enforces `@Roles(...)`. Registered globally *after* `AuthGuard`, so
 * `request.user` is already populated by the time this runs.
 *
 * A route without `@Roles()` is unaffected — authentication alone is enough.
 * Combining `@Roles()` with `@Public()` is not supported: there is no verified
 * user to check, so it is refused rather than silently allowed.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user || !required.includes(user.role as Role)) {
      // 403, not 401: the caller is authenticated, just not permitted. Saying
      // which role is missing is fine — it describes the endpoint, not the
      // caller's account.
      throw new ForbiddenException(
        `Requires one of the following roles: ${required.join(', ')}`,
      );
    }

    return true;
  }
}
