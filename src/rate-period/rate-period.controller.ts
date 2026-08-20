import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { ResortOwnerGuard } from '../resort/guards/resort-owner.guard';
import { RatePeriodService } from './rate-period.service';
import { CreateRatePeriodDto } from './dto/create-rate-period.dto';
import { UpdateRatePeriodDto } from './dto/update-rate-period.dto';
import { RatePeriodResponseDto } from './dto/rate-period-response.dto';

@ApiTags('rate-period')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('resort/:resortId/feature/:featureId/rate-period')
export class RatePeriodController {
  constructor(private readonly ratePeriodService: RatePeriodService) {}

  @Post()
  @UseGuards(ResortOwnerGuard)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @ApiOperation({
    summary:
      'Create a seasonal rate period for a feature — only its owner may do this',
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'featureId', type: String })
  async create(
    @Param('resortId') resortId: string,
    @Param('featureId') featureId: string,
    @Body() dto: CreateRatePeriodDto,
  ) {
    const period = await this.ratePeriodService.create(
      resortId,
      featureId,
      dto,
    );
    return RatePeriodResponseDto.fromEntity(period);
  }

  @Get()
  @UseGuards(ResortMemberGuard)
  @ApiOperation({
    summary:
      "List a feature's rate periods — its owner or employees may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'featureId', type: String })
  async findAll(
    @Param('resortId') resortId: string,
    @Param('featureId') featureId: string,
  ) {
    const periods = await this.ratePeriodService.findAll(resortId, featureId);
    return periods.map((period) => RatePeriodResponseDto.fromEntity(period));
  }

  @Get(':id')
  @UseGuards(ResortMemberGuard)
  @ApiOperation({
    summary:
      "Get one of a feature's rate periods — its owner or employees may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'featureId', type: String })
  @ApiParam({ name: 'id', type: String })
  async findOne(
    @Param('resortId') resortId: string,
    @Param('featureId') featureId: string,
    @Param('id') id: string,
  ) {
    const period = await this.ratePeriodService.findOne(
      resortId,
      featureId,
      id,
    );
    return RatePeriodResponseDto.fromEntity(period);
  }

  @Patch(':id')
  @UseGuards(ResortOwnerGuard)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @ApiOperation({
    summary:
      "Update one of a feature's rate periods — only its owner may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'featureId', type: String })
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('resortId') resortId: string,
    @Param('featureId') featureId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRatePeriodDto,
  ) {
    const period = await this.ratePeriodService.update(
      resortId,
      featureId,
      id,
      dto,
    );
    return RatePeriodResponseDto.fromEntity(period);
  }

  @Delete(':id')
  @UseGuards(ResortOwnerGuard)
  @ApiOperation({
    summary:
      "Delete one of a feature's rate periods — only its owner may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'featureId', type: String })
  @ApiParam({ name: 'id', type: String })
  remove(
    @Param('resortId') resortId: string,
    @Param('featureId') featureId: string,
    @Param('id') id: string,
  ) {
    return this.ratePeriodService.remove(resortId, featureId, id);
  }
}
