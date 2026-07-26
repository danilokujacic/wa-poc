import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
    MessageBatchProducer,
    MESSAGE_FLUSH_QUEUE,
    FlushJobData,
} from './messages.producer';
import { MESSAGE_SENDER } from './message-sender.interface';
import type { MessageSender } from './message-sender.interface';
import { AiService } from 'src/ai/ai.service';
import { ResortContextService } from 'src/resort/resort-context.service';
import { ResortFeatureRepository } from 'src/repository/resort-feature.repository';
import { ReservationRepository } from 'src/repository/reservation.repository';
import { REDIS_CLIENT } from 'src/redis/redis.provider';
import type { Resort } from 'src/entity/resort.entity';
import type { ResortFeature } from 'src/entity/resort-feature.entity';
import { ReservationStatus } from 'src/entity/reservation.entity';

const RESERVATION_MARKER_REGEX = /\[RESERVE feature="([^"]+)" start="(\d{4}-\d{2}-\d{2})" end="(\d{4}-\d{2}-\d{2})"\]/;

// Resorts seeded so far are in Montenegro; hardcoded until resorts carry their own timezone.
const RESORT_TIMEZONE = 'Europe/Podgorica';

// Rate limit: after this many AI-answered turns in a session, cool the conversation down.
// The reservation "1"/"2" confirmation shortcut doesn't count — it's not an AI call and
// blocking a guest from confirming a booking they already started would be bad UX.
const SESSION_MESSAGE_LIMIT = 5;
const COOLDOWN_SECONDS = 30 * 60;

const OVERWHELMED_MESSAGE =
    "We're experiencing high demand right now and couldn't process your message. Please try again in a few minutes.";

const SERVICE_UNAVAILABLE =
    "We're experiencing high demand right now and couldn't process your message. Please try again in a few minutes.";

const RESERVATION_CONFLICT_MESSAGE =
    "We're unable to process your reservation at this time due to a conflict. Please try again later.";

interface ReservationIntent {
    feature: string;
    start: string;
    end: string;
}

interface FeatureAvailability {
    feature: ResortFeature;
    availability: number;
}

@Processor(MESSAGE_FLUSH_QUEUE, {
    concurrency: 10,
})
export class MessageFlushProcessor extends WorkerHost {
    constructor(
        private readonly producer: MessageBatchProducer,
        private readonly aiService: AiService,
        private readonly resortContextService: ResortContextService,
        private readonly resortFeatureRepository: ResortFeatureRepository,
        private readonly reservationRepository: ReservationRepository,
        @Inject(MESSAGE_SENDER) private readonly messageSender: MessageSender,
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        @InjectPinoLogger(MessageFlushProcessor.name) private readonly logger: PinoLogger,
    ) {
        super();
    }

    async process(job: Job<FlushJobData>): Promise<void> {
        const { conversationKey, phoneNumberId, guestNumber, guestName } = job.data;

        const batch = await this.producer.drain(conversationKey);
        if (batch.length === 0) {
            this.logger.debug(`No messages to flush for ${conversationKey}`);
            return;
        }

        const combined = batch.map((m) => m.text).join('\n');
        this.logger.info(
            `Flushing ${batch.length} msg(s) from ${guestName} (${conversationKey}): ${combined}`,
        );
        try {
            const resort = await this.resortContextService.get(conversationKey, phoneNumberId);

            // handle the special case where the guest is replying to a reservation confirmation prompt
            if (
                resort &&
                (await this.handleReservationConfirmationReply(resort, guestNumber, phoneNumberId, combined))
            ) {
                return;
            }

            // cooldown for conversations that have hit the session message limit, to avoid overwhelming the AI service
            if (await this.isCoolingDown(conversationKey)) {
                this.logger.debug(`Conversation ${conversationKey} is cooling down, ignoring message`);
                return;
            }

            const featureContext = resort ? await this.buildFeatureContext(resort.id) : [];

            const prompt = this.buildPrompt(resort, combined, featureContext);

            let rawReply: string;
            try {
                rawReply = await this.aiService.generateReply(guestName, prompt);
            } catch (aiError) {
                await this.messageSender.sendText(phoneNumberId, guestNumber, OVERWHELMED_MESSAGE);
                return;
            }

            const { reservationIntent, reply } = this.extractReservationIntent(rawReply);

            if (resort && reservationIntent) {
                await this.tryCreateReservation(featureContext, guestNumber, reservationIntent);
            }

            await this.messageSender.sendText(phoneNumberId, guestNumber, reply);
            await this.registerSessionMessage(conversationKey, phoneNumberId, guestNumber);
            this.logger.info(`User with ID ${guestNumber} sent a message: ${combined}. Its processed reply is: ${rawReply}`);
        } catch (err) {
            this.logger.error(`Error processing flush job for ${conversationKey}: ${err}`);
            await this.messageSender.sendText(phoneNumberId, guestNumber, SERVICE_UNAVAILABLE);
            return;
        }


    }

    private async handleReservationConfirmationReply(
        resort: Resort,
        guestNumber: string,
        phoneNumberId: string,
        guestMessage: string,
    ): Promise<boolean> {
        const trimmed = guestMessage.trim();
        if (trimmed !== '1' && trimmed !== '2') {
            return false;
        }

        const pending = await this.reservationRepository.findLatestPendingForGuest(resort.id, guestNumber);
        if (!pending) {
            return false;
        }

        pending.status = trimmed === '1' ? ReservationStatus.ACCEPTED : ReservationStatus.DECLINED;
        await this.reservationRepository.save(pending);

        const confirmText =
            trimmed === '1'
                ? `Your reservation for ${pending.feature.name} has been confirmed!`
                : `Your reservation for ${pending.feature.name} has been declined.`;

        this.logger.info(`Guest ${guestNumber} responded with "${trimmed}" to reservation confirmation for ${pending.feature.name}. Updated status to ${pending.status}.`);
        await this.messageSender.sendText(phoneNumberId, guestNumber, confirmText);
        return true;
    }

    private async isCoolingDown(conversationKey: string): Promise<boolean> {
        const cooling = await this.redis.get(this.cooldownKey(conversationKey));
        return cooling !== null;
    }

    private async registerSessionMessage(
        conversationKey: string,
        phoneNumberId: string,
        guestNumber: string,
    ): Promise<void> {
        const countKey = this.sessionCountKey(conversationKey);
        const count = await this.redis.incr(countKey);
        await this.redis.expire(countKey, COOLDOWN_SECONDS);

        if (count >= SESSION_MESSAGE_LIMIT) {
            await this.redis.set(this.cooldownKey(conversationKey), '1', 'EX', COOLDOWN_SECONDS);
            await this.redis.del(countKey);
            this.logger.debug(`Conversation ${conversationKey} hit the session limit, cooling down`);
            await this.messageSender.sendText(
                phoneNumberId,
                guestNumber,
                "You've reached the message limit for this conversation. Please try again in 30 minutes.",
            );
        }
    }

    private sessionCountKey(conversationKey: string): string {
        return `wa:session-count:${conversationKey}`;
    }

    private cooldownKey(conversationKey: string): string {
        return `wa:cooldown:${conversationKey}`;
    }

    private async buildFeatureContext(resortId: string): Promise<FeatureAvailability[]> {
        const features = await this.resortFeatureRepository.find({ where: { resort: { id: resortId }, isActive: true } });

        return Promise.all(
            features.map(async (feature) => {
                const activeCount = await this.reservationRepository.countActiveForFeature(feature.id);
                return { feature, availability: Math.max(feature.quantity - activeCount, 0) };
            }),
        );
    }

    private async tryCreateReservation(
        featureContext: FeatureAvailability[],
        guestNumber: string,
        intent: ReservationIntent,
    ): Promise<void> {
        const match = featureContext.find(
            (fc) => fc.feature.name.toLowerCase() === intent.feature.toLowerCase(),
        );
        if (!match) {
            this.logger.debug(`AI referenced unknown feature "${intent.feature}"`);
            return;
        }
        if (match.availability <= 0) {
            this.logger.debug(`Feature "${match.feature.name}" has no availability, skipping reservation creation`);
            return;
        }

        const reservation = this.reservationRepository.create({
            feature: match.feature,
            startDate: intent.start as unknown as Date,
            endDate: intent.end as unknown as Date,
            phoneNumber: guestNumber,
        });
        await this.reservationRepository.save(reservation);
    }

    private extractReservationIntent(
        rawReply: string,
    ): { reservationIntent: ReservationIntent | null; reply: string } {
        const match = rawReply.match(RESERVATION_MARKER_REGEX);
        if (!match) {
            return { reservationIntent: null, reply: rawReply.trim() };
        }

        const [marker, feature, start, end] = match;
        return {
            reservationIntent: { feature, start, end },
            reply: rawReply.replace(marker, '').trim(),
        };
    }

    private buildPrompt(
        resort: Resort | null,
        guestMessage: string,
        featureContext: FeatureAvailability[],
    ): string {
        const resortName = resort?.name ?? 'the resort';

        const faqSection = resort?.faqs?.length
            ? resort.faqs
                .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
                .join('\n\n')
            : 'No FAQs available.';

        const contactSection = resort?.contacts?.length
            ? resort.contacts
                .map((contact) => `${contact.contact_name} (${contact.type}): ${contact.contact}`)
                .join('\n')
            : 'No contacts available.';

        const detailsSection =
            [
                resort?.address ? `Address: ${resort.address}` : null,
                resort?.startWorkingHours && resort?.endWorkingHours
                    ? `Working hours: ${resort.startWorkingHours} - ${resort.endWorkingHours}`
                    : null,
                resort?.website ? `Website: ${resort.website}` : null,
            ]
                .filter(Boolean)
                .join('\n') || 'No additional resort details available.';

        const sections = [
            `You are a helpful WhatsApp assistant for ${resortName}.`,
            `Resort details:`,
            detailsSection,
            `Contacts — share the relevant contact when the guest needs to reach the resort directly:`,
            contactSection,
            `Use the following FAQs to answer the guest when relevant:`,
            faqSection,
        ];

        if (featureContext.length > 0) {
            const featureSection = featureContext
                .map(({ feature, availability }) => {
                    const description = feature.description ? ` — ${feature.description}` : '';
                    return `- ${feature.name}: price ${feature.price}, available ${availability}/${feature.quantity}${description}`;
                })
                .join('\n');

            const today = new Date();
            const todayIso = new Intl.DateTimeFormat('en-CA', {
                timeZone: RESORT_TIMEZONE,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(today);
            const todayWeekday = new Intl.DateTimeFormat('en-US', {
                timeZone: RESORT_TIMEZONE,
                weekday: 'long',
            }).format(today);

            sections.push(
                `Bookable features and their current availability. Only mention prices when the guest explicitly asks about cost or pricing:`,
                featureSection,
                `Today's date is ${todayIso} (${todayWeekday}), resort local time.`,
                `Reservation flow: if the guest explicitly asks to reserve/book one of the features above, ask them naturally what dates they'd like (e.g. "What dates would you like to book?") — never ask them to type a date in YYYY-MM-DD or any specific format. Guests will answer in natural language, such as "next Friday", "tomorrow", "August 1st to 3rd", "this weekend", or "for 2 nights starting Monday" — using today's date above, work out the actual calendar dates yourself. Once you have identified both the feature and a start and end date, end your reply with a line in exactly this format (using the feature name exactly as written above and dates as YYYY-MM-DD — this line is for internal processing only, the guest should never see it or be asked to produce it): [RESERVE feature="<feature name>" start="<start date>" end="<end date>"]. Before that line, ask the guest to reply "1" to confirm or "2" to decline. Only include this line once the feature has availability remaining and you've worked out both dates — ask a natural clarifying question instead if the dates are ambiguous or missing, or explain it's fully booked if there's no availability.`,
                `Never guess or silently assume any date detail the guest didn't state — always ask instead. In particular: (1) if the guest gives only one date with no indication of how many nights or when they'd leave, do not assume a single-day stay — ask them when they'd like to check out or how many nights they're staying. (2) If the guest's own wording is internally contradictory or genuinely ambiguous about which dates they mean (for example "Friday next week until Monday next week", where a literal reading puts the Monday before the Friday), do not silently pick an interpretation — point out the contradiction in plain language and ask them to confirm the exact dates. (3) Any date you weren't given by the guest and haven't confirmed with them must never appear in the reservation marker — if you're unsure, ask rather than guess.`,
            );
        }

        sections.push(`Guest message:`, guestMessage);

        return sections.join('\n\n');
    }
}
