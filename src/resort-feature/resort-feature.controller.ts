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
import { ResortOwnerGuard } from '../resort/guards/resort-owner.guard';
import { ResortFeatureService } from './resort-feature.service';
import { CreateResortFeatureDto } from './dto/create-resort-feature.dto';
import { UpdateResortFeatureDto } from './dto/update-resort-feature.dto';

@ApiTags('resort-feature')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('resort/:resortId/feature')
export class ResortFeatureController {
    constructor(private readonly resortFeatureService: ResortFeatureService) { }

    @Post()
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: 'Create a feature for this resort — only its owner may do this' })
    @ApiParam({ name: 'resortId', type: String })
    create(@Param('resortId') resortId: string, @Body() dto: CreateResortFeatureDto) {
        return this.resortFeatureService.create(resortId, dto);
    }

    @Get()
    @UseGuards(ResortMemberGuard)
    @ApiOperation({ summary: "List a resort's features — its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    findAll(@Param('resortId') resortId: string) {
        return this.resortFeatureService.findAll(resortId);
    }

    @Get(':id')
    @UseGuards(ResortMemberGuard)
    @ApiOperation({ summary: "Get one of a resort's features — its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: String })
    findOne(@Param('resortId') resortId: string, @Param('id') id: string) {
        return this.resortFeatureService.findOne(resortId, id);
    }

    @Patch(':id')
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: "Update one of a resort's features — only its owner may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: String })
    update(
        @Param('resortId') resortId: string,
        @Param('id') id: string,
        @Body() dto: UpdateResortFeatureDto,
    ) {
        return this.resortFeatureService.update(resortId, id, dto);
    }

    @Delete(':id')
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: "Delete one of a resort's features — only its owner may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: String })
    remove(@Param('resortId') resortId: string, @Param('id') id: string) {
        return this.resortFeatureService.remove(resortId, id);
    }
}
