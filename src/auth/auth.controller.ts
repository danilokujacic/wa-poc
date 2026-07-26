import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
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
    ) { }

    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) response: Response) {
        const { accessToken, user } = await this.authService.register(registerDto);
        this.setAuthCookie(response, accessToken);
        return AuthResponseDto.fromUser(user);
    }

    @Post('login')
    @HttpCode(200)
    @ApiOperation({ summary: 'Login with email and password' })
    async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
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
