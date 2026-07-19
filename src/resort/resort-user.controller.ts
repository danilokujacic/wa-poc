import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Put,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortOwnerGuard } from './guards/resort-owner.guard';
import { ResortMemberGuard } from './guards/resort-member.guard';
import { ResortUserService } from './resort-user.service';
import { CreateResortUserDto } from './dto/create-resort-user.dto';
import { UpdateResortUserDto } from './dto/update-resort-user.dto';

@ApiTags('resort-user')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('resort/:resortId/user')
export class ResortUserController {
    constructor(private readonly resortUserService: ResortUserService) { }

    @Post()
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: 'Create an employee user tied to this resort' })
    @ApiParam({ name: 'resortId', type: String })
    create(@Param('resortId') resortId: string, @Body() dto: CreateResortUserDto) {
        return this.resortUserService.create(resortId, dto);
    }

    @Get()
    @UseGuards(ResortMemberGuard)
    @ApiOperation({ summary: "List a resort's users — only its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    findAll(@Param('resortId') resortId: string) {
        return this.resortUserService.findAll(resortId);
    }

    @Get(':userId')
    @UseGuards(ResortMemberGuard)
    @ApiOperation({ summary: "Get one of a resort's users — only its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'userId', type: String })
    findOne(@Param('resortId') resortId: string, @Param('userId') userId: string) {
        return this.resortUserService.findOne(resortId, userId);
    }

    @Put(':userId')
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: "Replace one of a resort's users" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'userId', type: String })
    replace(
        @Param('resortId') resortId: string,
        @Param('userId') userId: string,
        @Body() dto: CreateResortUserDto,
    ) {
        return this.resortUserService.replace(resortId, userId, dto);
    }

    @Patch(':userId')
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: "Partially update one of a resort's users" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'userId', type: String })
    update(
        @Param('resortId') resortId: string,
        @Param('userId') userId: string,
        @Body() dto: UpdateResortUserDto,
    ) {
        return this.resortUserService.update(resortId, userId, dto);
    }

    @Delete(':userId')
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: "Delete one of a resort's users" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'userId', type: String })
    remove(@Param('resortId') resortId: string, @Param('userId') userId: string) {
        return this.resortUserService.remove(resortId, userId);
    }
}
