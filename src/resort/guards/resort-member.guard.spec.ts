import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ResortMemberGuard } from './resort-member.guard';
import { UserRole } from '../../entity/user.entity';

function contextWith(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('ResortMemberGuard', () => {
  let guard: ResortMemberGuard;

  beforeEach(() => {
    guard = new ResortMemberGuard();
  });

  it('allows a user whose resortId matches the resort in the route params', () => {
    const user = {
      sub: 'user-1',
      email: 'a@b.com',
      role: UserRole.EMPLOYEE,
      resortId: 'resort-1',
    };

    const result = guard.canActivate(
      contextWith({ user, params: { resortId: 'resort-1' } }),
    );

    expect(result).toBe(true);
  });

  it('throws ForbiddenException when the user belongs to a different resort', () => {
    const user = {
      sub: 'user-1',
      email: 'a@b.com',
      role: UserRole.EMPLOYEE,
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
