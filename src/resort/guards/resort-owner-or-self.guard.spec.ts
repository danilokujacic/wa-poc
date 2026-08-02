import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ResortOwnerOrSelfGuard } from './resort-owner-or-self.guard';
import { UserRole } from '../../entity/user.entity';

function contextWith(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('ResortOwnerOrSelfGuard', () => {
  let guard: ResortOwnerOrSelfGuard;

  beforeEach(() => {
    guard = new ResortOwnerOrSelfGuard();
  });

  it('allows the resort owner to act on another user in the same resort', () => {
    const user = {
      sub: 'owner-1',
      email: 'a@b.com',
      role: UserRole.OWNER,
      resortId: 'resort-1',
    };

    const result = guard.canActivate(
      contextWith({ user, params: { resortId: 'resort-1', userId: 'user-2' } }),
    );

    expect(result).toBe(true);
  });

  it('allows a user to act on themselves even if not the owner', () => {
    const user = {
      sub: 'user-2',
      email: 'a@b.com',
      role: UserRole.EMPLOYEE,
      resortId: 'resort-1',
    };

    const result = guard.canActivate(
      contextWith({ user, params: { resortId: 'resort-1', userId: 'user-2' } }),
    );

    expect(result).toBe(true);
  });

  it('throws ForbiddenException when the owner belongs to a different resort', () => {
    const user = {
      sub: 'owner-1',
      email: 'a@b.com',
      role: UserRole.OWNER,
      resortId: 'resort-2',
    };

    expect(() =>
      guard.canActivate(
        contextWith({
          user,
          params: { resortId: 'resort-1', userId: 'user-3' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException for a non-owner acting on someone else', () => {
    const user = {
      sub: 'user-2',
      email: 'a@b.com',
      role: UserRole.EMPLOYEE,
      resortId: 'resort-1',
    };

    expect(() =>
      guard.canActivate(
        contextWith({
          user,
          params: { resortId: 'resort-1', userId: 'user-3' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no authenticated user', () => {
    expect(() =>
      guard.canActivate(
        contextWith({
          user: undefined,
          params: { resortId: 'resort-1', userId: 'user-1' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
