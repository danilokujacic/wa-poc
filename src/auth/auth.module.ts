import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserRepository } from '../repository/user.repository';
import { EmailConfirmationModule } from '../email-confirmation/email-confirmation.module';

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET,
            // jsonwebtoken types expiresIn against ms's template-literal StringValue type,
            // which an env-sourced string can't satisfy statically.
            signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as any },
        }),
        EmailConfirmationModule,
    ],
    controllers: [AuthController],
    providers: [AuthService, UserRepository, JwtAuthGuard],
    exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule { }
