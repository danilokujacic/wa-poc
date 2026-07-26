import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

@Injectable()
export class MailService implements OnModuleInit {
    private transporter: nodemailer.Transporter;
    private readonly from: string;

    constructor(
        private readonly configService: ConfigService,
        @InjectPinoLogger(MailService.name) private readonly logger: PinoLogger,
    ) {
        this.from = this.configService.get<string>('SMTP_FROM', 'wa-poc <no-reply@wa-poc.example.com>');
        this.transporter = nodemailer.createTransport({
            host: this.configService.get<string>('SMTP_HOST', 'localhost'),
            port: this.configService.get<number>('SMTP_PORT', 1025),
            secure: this.configService.get<string>('SMTP_SECURE', 'false') === 'true',
            auth: this.configService.get<string>('SMTP_USER')
                ? {
                    user: this.configService.get<string>('SMTP_USER'),
                    pass: this.configService.get<string>('SMTP_PASS'),
                }
                : undefined,
        });
    }

    async onModuleInit(): Promise<void> {
        try {
            await this.transporter.verify();
            this.logger.info('SMTP connection verified');
        } catch (error) {
            this.logger.warn(`SMTP connection could not be verified: ${error}`);
        }
    }

    async sendMail({ to, subject, html, text }: SendMailOptions): Promise<void> {
        try {
            await this.transporter.sendMail({
                from: this.from,
                to,
                subject,
                html,
                text: text ?? html.replace(/<[^>]+>/g, ''),
            });
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}: ${error}`);
        }
    }
}
