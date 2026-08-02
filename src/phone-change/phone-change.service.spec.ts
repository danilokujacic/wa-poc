import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhoneChangeService } from './phone-change.service';
import { PhoneChangeRepository } from '../repository/phone-change.repository';
import { ResortRepository } from '../repository/resort.repository';
import { MailService } from '../mail/mail.service';
import { PhoneChange } from '../entity/phone-change.entity';

describe('PhoneChangeService', () => {
  let service: PhoneChangeService;
  let phoneChangeRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findRecentForResort: jest.Mock;
  };
  let resortRepository: { findOneBy: jest.Mock };
  let mailService: { sendMail: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    phoneChangeRepository = {
      create: jest.fn((dto: Partial<PhoneChange>) => dto),
      save: jest.fn((entity: Partial<PhoneChange>) => Promise.resolve(entity)),
      findRecentForResort: jest.fn(),
    };
    resortRepository = {
      findOneBy: jest.fn(),
    };
    mailService = {
      sendMail: jest.fn(),
    };
    configService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhoneChangeService,
        { provide: PhoneChangeRepository, useValue: phoneChangeRepository },
        { provide: ResortRepository, useValue: resortRepository },
        { provide: MailService, useValue: mailService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<PhoneChangeService>(PhoneChangeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws NotFoundException when the resort does not exist', async () => {
    resortRepository.findOneBy.mockResolvedValue(null);

    await expect(service.create('resort-1', '+382 69 111 111')).rejects.toThrow(
      NotFoundException,
    );

    expect(resortRepository.findOneBy).toHaveBeenCalledWith({ id: 'resort-1' });
    expect(phoneChangeRepository.findRecentForResort).not.toHaveBeenCalled();
  });

  it('throws ConflictException when a change was already requested in the past week', async () => {
    resortRepository.findOneBy.mockResolvedValue({
      id: 'resort-1',
      name: 'Resort',
      phoneNumber: '+382 1',
    });
    phoneChangeRepository.findRecentForResort.mockResolvedValue({
      id: 'existing',
    });

    await expect(service.create('resort-1', '+382 69 111 111')).rejects.toThrow(
      ConflictException,
    );

    expect(phoneChangeRepository.save).not.toHaveBeenCalled();
  });

  it('creates a phone change request and sends an admin email when ADMIN_EMAIL is configured', async () => {
    const resort = {
      id: 'resort-1',
      name: 'Sunny Resort',
      phoneNumber: '+382 1',
    };
    resortRepository.findOneBy.mockResolvedValue(resort);
    phoneChangeRepository.findRecentForResort.mockResolvedValue(null);
    configService.get.mockReturnValue('admin@example.com');

    const result = await service.create('resort-1', '+382 69 111 111');

    expect(phoneChangeRepository.create).toHaveBeenCalledWith({
      resort,
      oldPhoneNumber: '+382 1',
      newPhoneNumber: '+382 69 111 111',
    });
    expect(phoneChangeRepository.save).toHaveBeenCalled();
    expect(mailService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: expect.stringContaining('Sunny Resort') as string,
        html: expect.stringContaining('+382 69 111 111') as string,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        oldPhoneNumber: '+382 1',
        newPhoneNumber: '+382 69 111 111',
      }),
    );
  });

  it('creates a phone change request without sending an email when ADMIN_EMAIL is not configured', async () => {
    const resort = {
      id: 'resort-1',
      name: 'Sunny Resort',
      phoneNumber: '+382 1',
    };
    resortRepository.findOneBy.mockResolvedValue(resort);
    phoneChangeRepository.findRecentForResort.mockResolvedValue(null);
    configService.get.mockReturnValue(undefined);

    const result = await service.create('resort-1', '+382 69 111 111');

    expect(mailService.sendMail).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        oldPhoneNumber: '+382 1',
        newPhoneNumber: '+382 69 111 111',
      }),
    );
  });
});
