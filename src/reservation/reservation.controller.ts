import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { ReservationService } from './reservation.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import { FindReservationsQueryDto } from './dto/find-reservations-query.dto';
import { LenientValidationPipe } from '../common/pipes/lenient-validation.pipe';
import { ReservationResponseDto } from './dto/reservation-response.dto';
import { FeatureAvailabilityResponseDto } from './dto/feature-availability-response.dto';

@ApiTags('reservation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ResortMemberGuard)
@Controller('resort/:resortId/reservation')
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

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
      'Create a reservation for this resort — its owner or employees may do this',
  })
  @ApiParam({ name: 'resortId', type: String })
  async create(
    @Param('resortId') resortId: string,
    @Body() dto: CreateReservationDto,
  ) {
    const reservation = await this.reservationService.create(resortId, dto);
    return ReservationResponseDto.fromEntity(reservation);
  }

  @Get()
  @ApiOperation({
    summary:
      "List a resort's reservations — its owner or employees may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    description: 'Start date filter (ISO string)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    description: 'End date filter (ISO string)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: "Reservation status, or 'ALL'",
  })
  @ApiQuery({
    name: 'phoneNumber',
    required: false,
    type: String,
    description: 'Filter by phone number (partial match)',
  })
  @ApiQuery({
    name: 'overbooked',
    required: false,
    type: Boolean,
    description: 'When true, only return currently-overbooked reservations',
  })
  async findAll(
    @Param('resortId') resortId: string,
    @Query(new LenientValidationPipe(FindReservationsQueryDto))
    query: FindReservationsQueryDto,
  ) {
    const reservations = await this.reservationService.findAll(resortId, query);
    return reservations.map((reservation) =>
      ReservationResponseDto.fromEntity(reservation),
    );
  }

  @Get('availability')
  @ApiOperation({
    summary:
      "Get availability for all of a resort's features — its owner or employees may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  async getAvailabilityForAllFeatures(@Param('resortId') resortId: string) {
    const results =
      await this.reservationService.getAvailabilityForAllFeatures(resortId);
    return results.map((result) =>
      FeatureAvailabilityResponseDto.fromResult(result),
    );
  }

  @Get('availability/:featureId')
  @ApiOperation({
    summary:
      "Get availability for one of a resort's features — its owner or employees may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'featureId', type: String })
  getAvailability(
    @Param('resortId') resortId: string,
    @Param('featureId') featureId: string,
  ) {
    return this.reservationService.getAvailability(resortId, featureId);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      "Get one of a resort's reservations — its owner or employees may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'id', type: String })
  async findOne(@Param('resortId') resortId: string, @Param('id') id: string) {
    const reservation = await this.reservationService.findOne(resortId, id);
    return ReservationResponseDto.fromEntity(reservation);
  }

  @Patch(':id')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @ApiOperation({
    summary:
      "Update one of a resort's reservations — its owner or employees may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('resortId') resortId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
  ) {
    const reservation = await this.reservationService.update(resortId, id, dto);
    return ReservationResponseDto.fromEntity(reservation);
  }

  @Patch(':id/status')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @ApiOperation({
    summary:
      "Update the status of one of a resort's reservations — its owner or employees may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'id', type: String })
  async updateStatus(
    @Param('resortId') resortId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReservationStatusDto,
  ) {
    const reservation = await this.reservationService.updateStatus(
      resortId,
      id,
      dto.status,
    );
    return ReservationResponseDto.fromEntity(reservation);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      "Delete one of a resort's reservations — its owner or employees may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('resortId') resortId: string, @Param('id') id: string) {
    return this.reservationService.remove(resortId, id);
  }
}
