import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ResortOwnerGuard } from './resort-owner.guard';
import { UserRole } from '../../entity/user.entity';

function contextWith(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('ResortOwnerGuard', () => {
  let guard: ResortOwnerGuard;

  beforeEach(() => {
    guard = new ResortOwnerGuard();
  });

  it('allows an owner acting on their own resort', () => {
    const user = {
      sub: 'user-1',
      email: 'a@b.com',
      role: UserRole.OWNER,
      resortId: 'resort-1',
    };

    const result = guard.canActivate(
      contextWith({ user, params: { resortId: 'resort-1' } }),
    );

    expect(result).toBe(true);
  });

  it('throws ForbiddenException for a non-owner employee', () => {
    const user = {
      sub: 'user-1',
      email: 'a@b.com',
      role: UserRole.EMPLOYEE,
      resortId: 'resort-1',
    };

    expect(() =>
      guard.canActivate(
        contextWith({ user, params: { resortId: 'resort-1' } }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException for an owner of a different resort', () => {
    const user = {
      sub: 'user-1',
      email: 'a@b.com',
      role: UserRole.OWNER,
      resortId: 'resort-2',
    };

    expect(() =>
      guard.canActivate(
        contextWith({ user, params: { resortId: 'resort-1' } }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no authenticated user', () => {
    expect(() =>
      guard.canActivate(
        contextWith({ user: undefined, params: { resortId: 'resort-1' } }),
      ),
    ).toThrow(ForbiddenException);
  });
});
