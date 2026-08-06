import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';

/**
 * The guard is registered globally, so these cases decide whether the entire
 * API is reachable. Worth more than a definedness check.
 */
describe('AuthGuard', () => {
  const contextFor = (headers: Record<string, string> = {}) => {
    const request: Record<string, unknown> = { headers };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
    return { context, request };
  };

  const buildGuard = (options: { isPublic?: boolean; verify?: jest.Mock }) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(options.isPublic ?? false),
    } as unknown as Reflector;
    const jwtService = {
      verifyAsync: options.verify ?? jest.fn(),
    } as unknown as JwtService;
    return new AuthGuard(jwtService, reflector);
  };

  it('should be defined', () => {
    expect(buildGuard({})).toBeDefined();
  });

  it('lets a @Public() route through without any token', async () => {
    const verify = jest.fn();
    const guard = buildGuard({ isPublic: true, verify });
    const { context } = contextFor();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    // The token is never even inspected for a public route.
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects a protected route with no Authorization header', async () => {
    const guard = buildGuard({});
    const { context } = contextFor();

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a scheme other than Bearer', async () => {
    const guard = buildGuard({});
    const { context } = contextFor({ authorization: 'Basic abc123' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token that fails verification', async () => {
    const verify = jest.fn().mockRejectedValue(new Error('bad signature'));
    const guard = buildGuard({ verify });
    const { context } = contextFor({ authorization: 'Bearer tampered' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('attaches the verified payload to the request', async () => {
    const payload = { userId: 7, username: 'janedoe' };
    const verify = jest.fn().mockResolvedValue(payload);
    const guard = buildGuard({ verify });
    const { context, request } = contextFor({ authorization: 'Bearer good' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(payload);
  });
});
