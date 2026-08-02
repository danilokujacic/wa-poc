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
import { ResortFeatureService } from './resort-feature.service';
import { CreateResortFeatureDto } from './dto/create-resort-feature.dto';
import { UpdateResortFeatureDto } from './dto/update-resort-feature.dto';
import { ResortFeatureResponseDto } from './dto/resort-feature-response.dto';

@ApiTags('resort-feature')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('resort/:resortId/feature')
export class ResortFeatureController {
  constructor(private readonly resortFeatureService: ResortFeatureService) {}

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
    summary: 'Create a feature for this resort — only its owner may do this',
  })
  @ApiParam({ name: 'resortId', type: String })
  async create(
    @Param('resortId') resortId: string,
    @Body() dto: CreateResortFeatureDto,
  ) {
    const feature = await this.resortFeatureService.create(resortId, dto);
    return ResortFeatureResponseDto.fromEntity(feature);
  }

  @Get()
  @UseGuards(ResortMemberGuard)
  @ApiOperation({
    summary: "List a resort's features — its owner or employees may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  async findAll(@Param('resortId') resortId: string) {
    const features = await this.resortFeatureService.findAll(resortId);
    return features.map((feature) =>
      ResortFeatureResponseDto.fromEntity(feature),
    );
  }

  @Get(':id')
  @UseGuards(ResortMemberGuard)
  @ApiOperation({
    summary:
      "Get one of a resort's features — its owner or employees may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'id', type: String })
  async findOne(@Param('resortId') resortId: string, @Param('id') id: string) {
    const feature = await this.resortFeatureService.findOne(resortId, id);
    return ResortFeatureResponseDto.fromEntity(feature);
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
    summary: "Update one of a resort's features — only its owner may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('resortId') resortId: string,
    @Param('id') id: string,
    @Body() dto: UpdateResortFeatureDto,
  ) {
    const feature = await this.resortFeatureService.update(resortId, id, dto);
    return ResortFeatureResponseDto.fromEntity(feature);
  }

  @Delete(':id')
  @UseGuards(ResortOwnerGuard)
  @ApiOperation({
    summary: "Delete one of a resort's features — only its owner may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('resortId') resortId: string, @Param('id') id: string) {
    return this.resortFeatureService.remove(resortId, id);
  }
}
