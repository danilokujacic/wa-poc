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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { ResortOwnerGuard } from '../resort/guards/resort-owner.guard';
import { ResortContactService } from './resort-contact.service';
import { CreateResortContactDto } from './dto/create-resort-contact.dto';
import { UpdateResortContactDto } from './dto/update-resort-contact.dto';
import { FindResortContactsQueryDto } from './dto/find-resort-contacts-query.dto';
import { LenientValidationPipe } from '../common/pipes/lenient-validation.pipe';
import { ResortContactResponseDto } from './dto/resort-contact-response.dto';

@ApiTags('resort-contact')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('resort/:resortId/contact')
export class ResortContactController {
    constructor(private readonly resortContactService: ResortContactService) { }

    @Post()
    @UseGuards(ResortOwnerGuard)
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    @ApiOperation({ summary: 'Create a contact for this resort — only its owner may do this' })
    @ApiParam({ name: 'resortId', type: String })
    async create(@Param('resortId') resortId: string, @Body() dto: CreateResortContactDto) {
        const contact = await this.resortContactService.create(resortId, dto);
        return ResortContactResponseDto.fromEntity(contact);
    }

    @Get()
    @UseGuards(ResortMemberGuard)
    @ApiOperation({ summary: "List a resort's contacts — its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Case-insensitive search across contact_name and contact' })
    async findAll(
        @Param('resortId') resortId: string,
        @Query(new LenientValidationPipe(FindResortContactsQueryDto)) query: FindResortContactsQueryDto,
    ) {
        const contacts = await this.resortContactService.findAll(resortId, query);
        return contacts.map((contact) => ResortContactResponseDto.fromEntity(contact));
    }

    @Get(':id')
    @UseGuards(ResortMemberGuard)
    @ApiOperation({ summary: "Get one of a resort's contacts — its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: String })
    async findOne(@Param('resortId') resortId: string, @Param('id') id: string) {
        const contact = await this.resortContactService.findOne(resortId, id);
        return ResortContactResponseDto.fromEntity(contact);
    }

    @Patch(':id')
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: "Update one of a resort's contacts — only its owner may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: String })
    async update(
        @Param('resortId') resortId: string,
        @Param('id') id: string,
        @Body() dto: UpdateResortContactDto,
    ) {
        const contact = await this.resortContactService.update(resortId, id, dto);
        return ResortContactResponseDto.fromEntity(contact);
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
