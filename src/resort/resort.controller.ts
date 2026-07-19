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

@ApiTags('resort')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('resort')
export class ResortController {
    constructor(private readonly resortService: ResortService) { }

    @Post()
    @ApiOperation({ summary: 'Create a resort for the authenticated user, who must not already have one' })
    create(@Body() createResortDto: CreateResortDto, @Req() request: Request & { user: JwtPayload }) {
        return this.resortService.create(createResortDto, request.user.sub);
    }

    @Get()
    @ApiOperation({ summary: 'List all resorts' })
    findAll() {
        return this.resortService.findAll();
    }

    @Get(':resortId')
    @UseGuards(ResortMemberGuard)
    @ApiOperation({ summary: 'Get a resort by id — only its owner or employees may do this' })
    @ApiParam({ name: 'resortId', type: String })
    findOne(@Param('resortId') resortId: string) {
        return this.resortService.findOne(resortId);
    }

    @Patch(':resortId')
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: 'Update a resort — only its owner may do this' })
    @ApiParam({ name: 'resortId', type: String })
    update(@Param('resortId') resortId: string, @Body() updateResortDto: UpdateResortDto) {
        return this.resortService.update(resortId, updateResortDto);
    }

    @Delete(':resortId')
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: 'Delete a resort — only its owner may do this' })
    @ApiParam({ name: 'resortId', type: String })
    remove(@Param('resortId') resortId: string) {
        return this.resortService.remove(resortId);
    }
}
