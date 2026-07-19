import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { ReservationService } from './reservation.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

@ApiTags('reservation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ResortMemberGuard)
@Controller('resort/:resortId/reservation')
export class ReservationController {
    constructor(private readonly reservationService: ReservationService) { }

    @Post()
    @ApiOperation({ summary: 'Create a reservation for this resort — its owner or employees may do this' })
    @ApiParam({ name: 'resortId', type: String })
    create(@Param('resortId') resortId: string, @Body() dto: CreateReservationDto) {
        return this.reservationService.create(resortId, dto);
    }

    @Get()
    @ApiOperation({ summary: "List a resort's reservations — its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    findAll(@Param('resortId') resortId: string) {
        return this.reservationService.findAll(resortId);
    }

    @Get(':id')
    @ApiOperation({ summary: "Get one of a resort's reservations — its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: String })
    findOne(@Param('resortId') resortId: string, @Param('id') id: string) {
        return this.reservationService.findOne(resortId, id);
    }

    @Patch(':id')
    @ApiOperation({ summary: "Update one of a resort's reservations — its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: String })
    update(
        @Param('resortId') resortId: string,
        @Param('id') id: string,
        @Body() dto: UpdateReservationDto,
    ) {
        return this.reservationService.update(resortId, id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: "Delete one of a resort's reservations — its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: String })
    remove(@Param('resortId') resortId: string, @Param('id') id: string) {
        return this.reservationService.remove(resortId, id);
    }
}
