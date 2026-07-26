import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ResortService } from './resort.service';
import { CreateResortDto } from './dto/create-resort.dto';
import { UpdateResortDto } from './dto/update-resort.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ResortOwnerGuard } from './guards/resort-owner.guard';
import { ResortMemberGuard } from './guards/resort-member.guard';
import { ResortResponseDto } from './dto/resort-response.dto';

@ApiTags('resort')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('resort')
export class ResortController {
    constructor(private readonly resortService: ResortService) { }

    @Post()
    @ApiOperation({ summary: 'Create a resort for the authenticated user, who must not already have one' })
    async create(@Body() createResortDto: CreateResortDto, @Req() request: Request & { user: JwtPayload }) {
        const resort = await this.resortService.create(createResortDto, request.user.sub);
        return ResortResponseDto.fromEntity(resort);
    }

    @Get()
    @ApiOperation({ summary: 'List all resorts' })
    async findAll() {
        const resorts = await this.resortService.findAll();
        return resorts.map((resort) => ResortResponseDto.fromEntity(resort));
    }

    @Get(':resortId')
    @UseGuards(ResortMemberGuard)
    @ApiOperation({ summary: 'Get a resort by id — only its owner or employees may do this' })
    @ApiParam({ name: 'resortId', type: String })
    async findOne(@Param('resortId') resortId: string) {
        const resort = await this.resortService.findOne(resortId);
        return ResortResponseDto.fromEntity(resort);
    }

    @Patch(':resortId')
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: 'Update a resort — only its owner may do this' })
    @ApiParam({ name: 'resortId', type: String })
    async update(@Param('resortId') resortId: string, @Body() updateResortDto: UpdateResortDto) {
        const resort = await this.resortService.update(resortId, updateResortDto);
        return ResortResponseDto.fromEntity(resort);
    }

    @Delete(':resortId')
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: 'Delete a resort — only its owner may do this' })
    @ApiParam({ name: 'resortId', type: String })
    remove(@Param('resortId') resortId: string) {
        return this.resortService.remove(resortId);
    }
}
