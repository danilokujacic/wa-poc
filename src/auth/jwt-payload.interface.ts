import { UserRole } from '../entity/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  resortId: string | null;
}
