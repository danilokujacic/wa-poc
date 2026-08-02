import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ResortService } from './resort.service';
import { ResortRepository } from '../repository/resort.repository';
import { UserRepository } from '../repository/user.repository';

describe('ResortService', () => {
  let service: ResortService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOneBy: jest.Mock;
    remove: jest.Mock;
  };
  let userRepository: { findOne: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    repository = {
      create: jest.fn((dto) => dto),
      save: jest.fn(async (entity) => entity),
      find: jest.fn(),
      findOneBy: jest.fn(),
      remove: jest.fn(),
    };
    userRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (entity) => entity),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResortService,
        { provide: ResortRepository, useValue: repository },
        { provide: UserRepository, useValue: userRepository },
      ],
    }).compile();

    service = module.get<ResortService>(ResortService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a resort for an owner with no resort yet', async () => {
    const dto = { name: 'Sunset Bay', phoneNumber: '123' };
    const owner = { id: 'user-1', resort: null };
    userRepository.findOne.mockResolvedValue(owner);

    const result = await service.create(dto, 'user-1');

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      relations: { resort: true },
    });
    expect(repository.create).toHaveBeenCalledWith(dto);
    expect(repository.save).toHaveBeenCalledWith(dto);
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ resort: dto }),
    );
    expect(result).toEqual(dto);
  });

  it('rejects creation when the owner is not found', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create({ name: 'Sunset Bay', phoneNumber: '123' }, 'missing'),
    ).rejects.toThrow(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects creation when the owner already has a resort', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      resort: { id: 'resort-1' },
    });

    await expect(
      service.create({ name: 'Sunset Bay', phoneNumber: '123' }, 'user-1'),
    ).rejects.toThrow(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects creation when the phoneNumber is already registered to another resort', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'user-1', resort: null });
    repository.findOneBy.mockResolvedValue({
      id: 'other-resort',
      phoneNumber: '123',
    });

    await expect(
      service.create({ name: 'Sunset Bay', phoneNumber: '123' }, 'user-1'),
    ).rejects.toThrow(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('returns all resorts', async () => {
    const resorts = [{ id: '1', name: 'Sunset Bay', phoneNumber: '123' }];
    repository.find.mockResolvedValue(resorts);

    const result = await service.findAll();

    expect(result).toBe(resorts);
  });

  it('returns a resort by id', async () => {
    const resort = { id: '1', name: 'Sunset Bay', phoneNumber: '123' };
    repository.findOneBy.mockResolvedValue(resort);

    const result = await service.findOne('1');

    expect(repository.findOneBy).toHaveBeenCalledWith({ id: '1' });
    expect(result).toBe(resort);
  });

  it('throws when a resort is not found', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('updates a resort', async () => {
    const resort = { id: '1', name: 'Sunset Bay', phoneNumber: '123' };
    repository.findOneBy.mockResolvedValue(resort);

    const result = await service.update('1', { name: 'New Name' });

    expect(repository.save).toHaveBeenCalledWith({
      ...resort,
      name: 'New Name',
    });
    expect(result.name).toBe('New Name');
  });

  it('allows updating a resort without changing its phoneNumber, skipping the uniqueness check', async () => {
    const resort = { id: '1', name: 'Sunset Bay', phoneNumber: '123' };
    repository.findOneBy.mockResolvedValue(resort);

    await service.update('1', { phoneNumber: '123' });

    expect(repository.findOneBy).toHaveBeenCalledTimes(1);
  });

  it('rejects updating a resort to a phoneNumber already used by another resort', async () => {
    const resort = { id: '1', name: 'Sunset Bay', phoneNumber: '123' };
    repository.findOneBy
      .mockResolvedValueOnce(resort)
      .mockResolvedValueOnce({ id: '2', phoneNumber: '999' });

    await expect(service.update('1', { phoneNumber: '999' })).rejects.toThrow(
      ConflictException,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('removes a resort', async () => {
    const resort = { id: '1', name: 'Sunset Bay', phoneNumber: '123' };
    repository.findOneBy.mockResolvedValue(resort);

    await service.remove('1');

    expect(repository.remove).toHaveBeenCalledWith(resort);
  });
});
