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
import { ResortOwnerGuard } from '../resort/guards/resort-owner.guard';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { ResortOwnerOrSelfGuard } from '../resort/guards/resort-owner-or-self.guard';
import { ResortUserService } from './resort-user.service';
import { CreateResortUserDto } from './dto/create-resort-user.dto';
import { UpdateResortUserDto } from './dto/update-resort-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

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
    async create(@Param('resortId') resortId: string, @Body() dto: CreateResortUserDto) {
        const user = await this.resortUserService.create(resortId, dto);
        return UserResponseDto.fromEntity(user);
    }

    @Get()
    @UseGuards(ResortMemberGuard)
    @ApiOperation({ summary: "List a resort's users — only its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    async findAll(@Param('resortId') resortId: string) {
        const users = await this.resortUserService.findAll(resortId);
        return users.map((user) => UserResponseDto.fromEntity(user));
    }

    @Get(':userId')
    @UseGuards(ResortMemberGuard)
    @ApiOperation({ summary: "Get one of a resort's users — only its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'userId', type: String })
    async findOne(@Param('resortId') resortId: string, @Param('userId') userId: string) {
        const user = await this.resortUserService.findOne(resortId, userId);
        return UserResponseDto.fromEntity(user);
    }

    @Put(':userId')
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: "Replace one of a resort's users" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'userId', type: String })
    async replace(
        @Param('resortId') resortId: string,
        @Param('userId') userId: string,
        @Body() dto: CreateResortUserDto,
    ) {
        const user = await this.resortUserService.replace(resortId, userId, dto);
        return UserResponseDto.fromEntity(user);
    }

    @Patch(':userId')
    @UseGuards(ResortOwnerGuard)
    @ApiOperation({ summary: "Partially update one of a resort's users" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'userId', type: String })
    async update(
        @Param('resortId') resortId: string,
        @Param('userId') userId: string,
        @Body() dto: UpdateResortUserDto,
    ) {
        const user = await this.resortUserService.update(resortId, userId, dto);
        return UserResponseDto.fromEntity(user);
    }

    @Delete(':userId')
    @UseGuards(ResortOwnerOrSelfGuard)
    @ApiOperation({ summary: "Delete one of a resort's users — only its owner, or the user themselves, may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'userId', type: String })
    remove(@Param('resortId') resortId: string, @Param('userId') userId: string) {
        return this.resortUserService.remove(resortId, userId);
    }
}
