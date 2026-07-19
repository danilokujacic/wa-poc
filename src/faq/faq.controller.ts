import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { FaqService } from './faq.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

@ApiTags('faq')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ResortMemberGuard)
@Controller('resort/:resortId/faq')
export class FaqController {
    constructor(private readonly faqService: FaqService) { }

    @Post()
    @ApiOperation({ summary: "Create a faq for this resort" })
    @ApiParam({ name: 'resortId', type: String })
    create(@Param('resortId') resortId: string, @Body() createFaqDto: CreateFaqDto) {
        return this.faqService.create(resortId, createFaqDto);
    }

    @Get()
    @ApiOperation({ summary: "List a resort's faqs" })
    @ApiParam({ name: 'resortId', type: String })
    findAll(@Param('resortId') resortId: string) {
        return this.faqService.findAll(resortId);
    }

    @Get(':id')
    @ApiOperation({ summary: "Get one of a resort's faqs" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: Number })
    findOne(@Param('resortId') resortId: string, @Param('id', ParseIntPipe) id: number) {
        return this.faqService.findOne(resortId, id);
    }

    @Patch(':id')
    @ApiOperation({ summary: "Update one of a resort's faqs" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: Number })
    update(
        @Param('resortId') resortId: string,
        @Param('id', ParseIntPipe) id: number,
        @Body() updateFaqDto: UpdateFaqDto,
    ) {
        return this.faqService.update(resortId, id, updateFaqDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: "Delete one of a resort's faqs" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: Number })
    remove(@Param('resortId') resortId: string, @Param('id', ParseIntPipe) id: number) {
        return this.faqService.remove(resortId, id);
    }
}
