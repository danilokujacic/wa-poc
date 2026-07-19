import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../repository/user.repository';
import { ResortRepository } from '../repository/resort.repository';
import { User, UserRole } from '../entity/user.entity';
import { CreateResortUserDto } from './dto/create-resort-user.dto';
import { UpdateResortUserDto } from './dto/update-resort-user.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class ResortUserService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly resortRepository: ResortRepository,
    ) { }

    async create(resortId: string, dto: CreateResortUserDto): Promise<Omit<User, 'password'>> {
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

        return this.toSafeUser(user);
    }

    async findAll(resortId: string): Promise<Omit<User, 'password'>[]> {
        await this.ensureResortExists(resortId);

        const users = await this.userRepository.find({ where: { resort: { id: resortId } } });
        return users.map((user) => this.toSafeUser(user));
    }

    async findOne(resortId: string, userId: string): Promise<Omit<User, 'password'>> {
        const user = await this.findResortUserOrThrow(resortId, userId);
        return this.toSafeUser(user);
    }

    async replace(resortId: string, userId: string, dto: CreateResortUserDto): Promise<Omit<User, 'password'>> {
        const user = await this.findResortUserOrThrow(resortId, userId);

        user.name = dto.name;
        user.email = dto.email;
        user.password = await bcrypt.hash(dto.password, SALT_ROUNDS);

        return this.toSafeUser(await this.userRepository.save(user));
    }

    async update(resortId: string, userId: string, dto: UpdateResortUserDto): Promise<Omit<User, 'password'>> {
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

        return this.toSafeUser(await this.userRepository.save(user));
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

    private toSafeUser(user: User): Omit<User, 'password'> {
        const { password, ...rest } = user;
        return rest;
    }
}
