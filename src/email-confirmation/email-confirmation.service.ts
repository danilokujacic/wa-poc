import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { randomBytes, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { EmailConfirmationRepository } from '../repository/email-confirmation.repository';
import { User } from '../entity/user.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class EmailConfirmationService {
    constructor(
        private readonly emailConfirmationRepository: EmailConfirmationRepository,
        private readonly mailService: MailService,
        private readonly configService: ConfigService,
        private readonly dataSource: DataSource,
        @InjectPinoLogger(EmailConfirmationService.name) private readonly logger: PinoLogger,
    ) { }

    async createAndSend(user: User): Promise<void> {
        const expiryHours = this.configService.get<number>('EMAIL_CONFIRMATION_EXPIRY_HOURS', 24);
        const expires = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

        const confirmation = await this.emailConfirmationRepository.save(
            this.emailConfirmationRepository.create({
                user,
                slug: randomUUID(),
                code: randomBytes(32).toString('hex'),
                expires,
            }),
        );

        this.logger.info(`Email confirmation for ${user.email} — slug: ${confirmation.slug}, code: ${confirmation.code}`);

        await this.mailService.sendMail({
            to: user.email,
            subject: 'Confirm your email address',
            html: `<p>Hi ${user.name},</p>` +
                `<p>To confirm your email address, submit the following to the email confirmation endpoint (POST /email-confirmation):</p>` +
                `<p>slug: ${confirmation.slug}<br/>code: ${confirmation.code}</p>` +
                `<p>This expires in ${expiryHours} hour(s).</p>`,
        });
    }

    async confirm(slug: string, code: string): Promise<void> {
        const confirmation = await this.emailConfirmationRepository.findValidBySlug(slug);
        if (!confirmation) {
            throw new NotFoundException('Confirmation link not found');
        }

        if (confirmation.expires.getTime() < Date.now()) {
            await this.emailConfirmationRepository.remove(confirmation);
            throw new BadRequestException('Confirmation link has expired');
        }

        if (confirmation.code !== code) {
            throw new BadRequestException('Invalid confirmation code');
        }

        await this.dataSource.transaction(async (manager) => {
            await manager.update(User, confirmation.user.id, { emailConfirmed: true });
            await manager.remove(confirmation);
        });
    }
}
