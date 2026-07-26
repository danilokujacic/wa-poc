import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhoneChangeRepository } from '../repository/phone-change.repository';
import { ResortRepository } from '../repository/resort.repository';
import { PhoneChange } from '../entity/phone-change.entity';
import { MailService } from '../mail/mail.service';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class PhoneChangeService {
    constructor(
        private readonly phoneChangeRepository: PhoneChangeRepository,
        private readonly resortRepository: ResortRepository,
        private readonly mailService: MailService,
        private readonly configService: ConfigService,
    ) { }

    async create(resortId: string, newPhoneNumber: string): Promise<PhoneChange> {
        const resort = await this.resortRepository.findOneBy({ id: resortId });
        if (!resort) {
            throw new NotFoundException(`Resort with id ${resortId} not found`);
        }

        const oneWeekAgo = new Date(Date.now() - ONE_WEEK_MS);
        const recent = await this.phoneChangeRepository.findRecentForResort(resortId, oneWeekAgo);
        if (recent) {
            throw new ConflictException('A phone number change request was already submitted for this resort in the past week');
        }

        const phoneChange = await this.phoneChangeRepository.save(
            this.phoneChangeRepository.create({
                resort,
                oldPhoneNumber: resort.phoneNumber,
                newPhoneNumber,
            }),
        );

        const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
        if (adminEmail) {
            await this.mailService.sendMail({
                to: adminEmail,
                subject: `Phone number change request — ${resort.name}`,
                html: `<p>Resort <strong>${resort.name}</strong> (${resort.id}) requested a phone number change.</p>` +
                    `<p>Old: ${phoneChange.oldPhoneNumber}<br/>New: ${phoneChange.newPhoneNumber}</p>`,
            });
        }

        return phoneChange;
    }
}
