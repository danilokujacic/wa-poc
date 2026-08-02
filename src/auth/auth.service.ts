import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../repository/user.repository';
import { User, UserRole } from '../entity/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt-payload.interface';
import { EmailConfirmationService } from '../email-confirmation/email-confirmation.service';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly emailConfirmationService: EmailConfirmationService,
  ) {}

  async register(
    registerDto: RegisterDto,
  ): Promise<{ accessToken: string; user: User }> {
    const existing = await this.userRepository.findByEmail(registerDto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, SALT_ROUNDS);
    const user = await this.userRepository.save(
      this.userRepository.create({
        name: registerDto.name,
        email: registerDto.email,
        password: hashedPassword,
        role: UserRole.OWNER,
      }),
    );

    await this.emailConfirmationService.createAndSend(user);

    return this.buildAuthResponse(user);
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ accessToken: string; user: User }> {
    const user = await this.userRepository.findByEmail(loginDto.email);
    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: User): { accessToken: string; user: User } {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,

      resortId: user.resort?.id ?? null,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user,
    };
  }
}
