import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ACCESS_TOKEN_COOKIE } from './auth.constants';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  // Tighter than the global default — registration is a classic spam/abuse
  // target, and each successful call also sends a real confirmation email.
  @Throttle({
    default: {
      limit: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 5),
      ttl: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 60_000),
    },
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, user } = await this.authService.register(registerDto);
    this.setAuthCookie(response, accessToken);
    return AuthResponseDto.fromUser(user);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email and password' })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  // Tighter than the global default — the classic brute-force/credential-
  // stuffing target. Per-IP tracking (the guard's default) is the right
  // choice here, unlike the webhook guards, since a real login attempt has
  // a real client IP behind it, not a relay.
  @Throttle({
    default: {
      limit: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 5),
      ttl: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 60_000),
    },
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, user } = await this.authService.login(loginDto);
    this.setAuthCookie(response, accessToken);
    return AuthResponseDto.fromUser(user);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear the auth cookie' })
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    return LogoutResponseDto.create();
  }

  private setAuthCookie(response: Response, accessToken: string): void {
    const payload = this.jwtService.decode<{ exp: number }>(accessToken);
    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: new Date(payload.exp * 1000),
      path: '/',
    });
  }
}
