import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import { FaqService } from './faq.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { FaqSortableField, FindFaqsQueryDto } from './dto/find-faqs-query.dto';
import { LenientValidationPipe } from '../common/pipes/lenient-validation.pipe';
import { FaqResponseDto } from './dto/faq-response.dto';
import { PaginatedFaqResponseDto } from './dto/paginated-faq-response.dto';

@ApiTags('faq')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ResortMemberGuard)
@Controller('resort/:resortId/faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Post()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @ApiOperation({ summary: 'Create a faq for this resort' })
  @ApiParam({ name: 'resortId', type: String })
  async create(
    @Param('resortId') resortId: string,
    @Body() createFaqDto: CreateFaqDto,
  ) {
    const faq = await this.faqService.create(resortId, createFaqDto);
    return FaqResponseDto.fromEntity(faq);
  }

  @Get()
  @ApiOperation({ summary: "List a resort's faqs" })
  @ApiParam({ name: 'resortId', type: String })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Case-insensitive search across question and answer',
  })
  @ApiQuery({ name: 'sortBy', required: false, enum: FaqSortableField })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Param('resortId') resortId: string,
    @Query(new LenientValidationPipe(FindFaqsQueryDto)) query: FindFaqsQueryDto,
  ) {
    const result = await this.faqService.findAll(resortId, query);
    return PaginatedFaqResponseDto.fromResult(result);
  }

  @Get(':id')
  @ApiOperation({ summary: "Get one of a resort's faqs" })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'id', type: Number })
  async findOne(
    @Param('resortId') resortId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const faq = await this.faqService.findOne(resortId, id);
    return FaqResponseDto.fromEntity(faq);
  }

  @Patch(':id')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @ApiOperation({ summary: "Update one of a resort's faqs" })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'id', type: Number })
  async update(
    @Param('resortId') resortId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFaqDto: UpdateFaqDto,
  ) {
    const faq = await this.faqService.update(resortId, id, updateFaqDto);
    return FaqResponseDto.fromEntity(faq);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Delete one of a resort's faqs" })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'id', type: Number })
  remove(
    @Param('resortId') resortId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.faqService.remove(resortId, id);
  }
}
