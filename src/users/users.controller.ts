import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ResortUserService } from './resort-user.service';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly resortUserService: ResortUserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  async me(@Req() request: Request & { user: JwtPayload }) {
    const user = await this.resortUserService.findMe(request.user.sub);
    return UserResponseDto.fromEntity(user);
  }
}
