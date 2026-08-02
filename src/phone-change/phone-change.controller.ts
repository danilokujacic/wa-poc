import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortOwnerGuard } from '../resort/guards/resort-owner.guard';
import { PhoneChangeService } from './phone-change.service';
import { CreatePhoneChangeDto } from './dto/create-phone-change.dto';
import { PhoneChangeResponseDto } from './dto/phone-change-response.dto';

@ApiTags('phone-change')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ResortOwnerGuard)
@Controller('resort/:resortId/phone-change')
export class PhoneChangeController {
  constructor(private readonly phoneChangeService: PhoneChangeService) {}

  @Post()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @ApiOperation({
    summary:
      'Request a phone number change for this resort — only its owner may do this; requires manual approval, max once per week',
  })
  @ApiParam({ name: 'resortId', type: String })
  async create(
    @Param('resortId') resortId: string,
    @Body() dto: CreatePhoneChangeDto,
  ) {
    const phoneChange = await this.phoneChangeService.create(
      resortId,
      dto.newPhoneNumber,
    );
    return PhoneChangeResponseDto.fromEntity(phoneChange);
  }
}
