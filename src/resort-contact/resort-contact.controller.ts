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
import { ResortContactService } from './resort-contact.service';
import { CreateResortContactDto } from './dto/create-resort-contact.dto';
import { UpdateResortContactDto } from './dto/update-resort-contact.dto';

@ApiTags('resort-contact')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('resort/:resortId/contact')
export class ResortContactController {
    constructor(private readonly resortContactService: ResortContactService) { }

    @Post()
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: 'Create a contact for this resort — only its owner may do this' })
    @ApiParam({ name: 'resortId', type: String })
    create(@Param('resortId') resortId: string, @Body() dto: CreateResortContactDto) {
        return this.resortContactService.create(resortId, dto);
    }

    @Get()
    @UseGuards(ResortMemberGuard)
    @ApiOperation({ summary: "List a resort's contacts — its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    findAll(@Param('resortId') resortId: string) {
        return this.resortContactService.findAll(resortId);
    }

    @Get(':id')
    @UseGuards(ResortMemberGuard)
    @ApiOperation({ summary: "Get one of a resort's contacts — its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: String })
    findOne(@Param('resortId') resortId: string, @Param('id') id: string) {
        return this.resortContactService.findOne(resortId, id);
    }

    @Patch(':id')
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: "Update one of a resort's contacts — only its owner may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: String })
    update(
        @Param('resortId') resortId: string,
        @Param('id') id: string,
        @Body() dto: UpdateResortContactDto,
    ) {
        return this.resortContactService.update(resortId, id, dto);
    }

    @Delete(':id')
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: "Delete one of a resort's contacts — only its owner may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: String })
    remove(@Param('resortId') resortId: string, @Param('id') id: string) {
        return this.resortContactService.remove(resortId, id);
    }
}
