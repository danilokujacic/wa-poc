import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../repository/user.repository';
import { ResortRepository } from '../repository/resort.repository';
import { User, UserRole } from '../entity/user.entity';
import { CreateResortUserDto } from './dto/create-resort-user.dto';
import { UpdateResortUserDto } from './dto/update-resort-user.dto';
import { EmailConfirmationService } from '../email-confirmation/email-confirmation.service';

const SALT_ROUNDS = 10;

@Injectable()
export class ResortUserService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly resortRepository: ResortRepository,
        private readonly emailConfirmationService: EmailConfirmationService,
    ) { }

    async create(resortId: string, dto: CreateResortUserDto): Promise<User> {
        await this.ensureResortExists(resortId);

        const existing = await this.userRepository.findByEmail(dto.email);
        if (existing) {
            throw new ConflictException('Email is already registered');
        }

        const user = await this.userRepository.save(
            this.userRepository.create({
                name: dto.name,
                email: dto.email,
                password: await bcrypt.hash(dto.password, SALT_ROUNDS),
                role: UserRole.EMPLOYEE,
                resort: { id: resortId } as User['resort'],
            }),
        );

        await this.emailConfirmationService.createAndSend(user);

        return user;
    }

    async findAll(resortId: string): Promise<User[]> {
        await this.ensureResortExists(resortId);

        return this.userRepository.find({ where: { resort: { id: resortId } } });
    }

    async findOne(resortId: string, userId: string): Promise<User> {
        return this.findResortUserOrThrow(resortId, userId);
    }

    async findMe(userId: string): Promise<User> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: { resort: true },
        });
        if (!user) {
            throw new NotFoundException(`User with id ${userId} not found`);
        }
        return user;
    }

    async replace(resortId: string, userId: string, dto: CreateResortUserDto): Promise<User> {
        const user = await this.findResortUserOrThrow(resortId, userId);

        user.name = dto.name;
        user.email = dto.email;
        user.password = await bcrypt.hash(dto.password, SALT_ROUNDS);

        return this.userRepository.save(user);
    }

    async update(resortId: string, userId: string, dto: UpdateResortUserDto): Promise<User> {
        const user = await this.findResortUserOrThrow(resortId, userId);

        if (dto.name !== undefined) {
            user.name = dto.name;
        }
        if (dto.email !== undefined) {
            user.email = dto.email;
        }
        if (dto.password !== undefined) {
            user.password = await bcrypt.hash(dto.password, SALT_ROUNDS);
        }

        return this.userRepository.save(user);
    }

    async remove(resortId: string, userId: string): Promise<void> {
        const user = await this.findResortUserOrThrow(resortId, userId);
        await this.userRepository.remove(user);
    }

    private async ensureResortExists(resortId: string): Promise<void> {
        const resort = await this.resortRepository.findOneBy({ id: resortId });
        if (!resort) {
            throw new NotFoundException(`Resort with id ${resortId} not found`);
        }
    }

    private async findResortUserOrThrow(resortId: string, userId: string): Promise<User> {
        const user = await this.userRepository.findOne({
            where: { id: userId, resort: { id: resortId } },
        });
        if (!user) {
            throw new NotFoundException(`User with id ${userId} not found for resort ${resortId}`);
        }
        return user;
    }
}
