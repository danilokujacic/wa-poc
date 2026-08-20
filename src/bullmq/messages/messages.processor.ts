import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
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
import { ConversationRepository } from 'src/repository/conversation.repository';
import { RatePeriodRepository } from 'src/repository/rate-period.repository';
import { resolveRate } from 'src/rate-period/rate-period.util';
import type { ResolvedRate } from 'src/rate-period/rate-period.types';
import { REDIS_CLIENT } from 'src/redis/redis.provider';
import type { Resort } from 'src/entity/resort.entity';
import type { ResortFeature } from 'src/entity/resort-feature.entity';
import { ReservationStatus } from 'src/entity/reservation.entity';
import { DESK_EVENTS } from 'src/desk/desk.events';
import type { AiRepliedEvent } from 'src/desk/desk.events';

const RESERVATION_MARKER_REGEX =
  /\[RESERVE feature="([^"]+)" start="(\d{4}-\d{2}-\d{2})" end="(\d{4}-\d{2}-\d{2})" adults="(\d+)" kids="(\d+)"\]/;

// Loose match used only to strip the marker from the guest-visible reply — deliberately not
// anchored to the exact field list/order above. If the model emits a malformed marker (e.g. a
// non-numeric adults value) the strict regex above won't parse it, but this one still catches
// and removes it, so a malformed marker never leaks to the guest as raw text.
const RESERVATION_MARKER_STRIP_REGEX = /\[RESERVE[^\]]*\]/g;

// Resorts seeded so far are in Montenegro; hardcoded until resorts carry their own timezone.
export const RESORT_TIMEZONE = 'Europe/Podgorica';

// Rate limit: after this many AI-answered turns in a session, cool the conversation down.
// The reservation "1"/"2" confirmation shortcut doesn't count — it's not an AI call and
// blocking a guest from confirming a booking they already started would be bad UX.
const SESSION_MESSAGE_LIMIT = Number(process.env.SESSION_MESSAGE_LIMIT ?? 15);
const COOLDOWN_SECONDS = 30 * 60;

const OVERWHELMED_MESSAGE =
  "We're experiencing high demand right now and couldn't process your message. Please try again in a few minutes.";

const SERVICE_UNAVAILABLE =
  "We're experiencing high demand right now and couldn't process your message. Please try again in a few minutes.";

interface ReservationIntent {
  feature: string;
  start: string;
  end: string;
  adults: number;
  kids: number;
}

interface ConversationTurn {
  role: 'guest' | 'assistant';
  text: string;
}

// How many prior turns (guest + assistant combined) are kept and replayed into the prompt.
// Bounded so the prompt doesn't grow unboundedly over a long conversation — a multi-step flow
// like gathering a reservation's feature/dates/guest-counts comfortably fits well within this.
const CONVERSATION_HISTORY_MAX_TURNS = 20;
// Matches the session/cooldown lifetime this file already reasons in (see SESSION_MESSAGE_LIMIT/
// COOLDOWN_SECONDS above) — history a guest abandoned for a day is stale context, not memory.
const CONVERSATION_HISTORY_TTL_SECONDS = 24 * 3600;

interface FeatureAvailability {
  feature: ResortFeature;
  availability: number;
  // Today's resolved price/policy (see rate-period.util.ts) — falls back to
  // feature.price when no RatePeriod covers today. This is what actually
  // gets quoted to the guest; feature.price alone is stale the moment a
  // season is in effect. NOTE: resolved for *today*, not whatever future
  // dates the guest ends up asking about — if a guest's stay crosses into a
  // different season than today, the AI is still quoting today's rate. Not
  // solved here; would need the reservation flow to re-resolve once dates
  // are known, not just at the initial feature-listing stage.
  rate: ResolvedRate;
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
    private readonly conversationRepository: ConversationRepository,
    private readonly ratePeriodRepository: RatePeriodRepository,
    private readonly eventEmitter: EventEmitter2,
    @Inject(MESSAGE_SENDER) private readonly messageSender: MessageSender,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectPinoLogger(MessageFlushProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job<FlushJobData>): Promise<void> {
    const { conversationKey, phoneNumberId, guestNumber, guestName } = job.data;

    const batch = await this.producer.drain(conversationKey);
    if (batch.length === 0) {
      this.logger.debug({ conversationKey }, 'No messages to flush');
      return;
    }

    // Fresh correlation id for this debounce/flush cycle — a single AI turn can answer
    // several batched guest messages, so it can't just reuse one of their wamids. The wamids
    // that make up the batch are logged alongside it so the two can still be cross-referenced.
    const traceId = randomUUID();
    const combined = batch.map((m) => m.text).join('\n');
    // Intentionally never logging `combined`/`rawReply` (or any other message content) here
    // or anywhere below — guest/AI message text must not reach the log pipeline / Grafana.
    this.logger.info(
      {
        traceId,
        conversationKey,
        messageCount: batch.length,
        sourceMessageIds: batch.map((m) => m.id),
      },
      'Flushing debounced batch',
    );
    try {
      const resort = await this.resortContextService.get(
        conversationKey,
        phoneNumberId,
      );

      // an employee has taken over this conversation from the desk — the bot must stay
      // silent entirely (including the reservation confirm/decline shortcut below) so the
      // guest never gets an automated reply while a human is actively answering them.
      if (
        resort &&
        (await this.conversationRepository.isHumanHandled(
          resort.id,
          guestNumber,
        ))
      ) {
        this.logger.debug(
          { traceId, conversationKey },
          'Conversation is human-handled, skipping AI processing',
        );
        return;
      }

      // handle the special case where the guest is replying to a reservation confirmation prompt
      if (
        resort &&
        (await this.handleReservationConfirmationReply(
          resort,
          guestNumber,
          phoneNumberId,
          combined,
          traceId,
        ))
      ) {
        return;
      }

      // cooldown for conversations that have hit the session message limit, to avoid overwhelming the AI service
      if (await this.isCoolingDown(conversationKey)) {
        this.logger.debug(
          { traceId, conversationKey },
          'Conversation is cooling down, ignoring message',
        );
        return;
      }

      const featureContext = resort
        ? await this.buildFeatureContext(resort.id)
        : [];

      // Without this, every debounce cycle is a fresh, memoryless call to the AI — it would
      // ask for a reservation's dates, get an answer, then forget it ever asked by the next
      // message. This replays the recent turns so the model can pick up where it left off.
      const history = await this.getConversationHistory(conversationKey);
      const prompt = this.buildPrompt(
        resort,
        combined,
        featureContext,
        guestName,
        history,
      );

      let rawReply: string;
      try {
        rawReply = await this.aiService.generateReply(guestName, prompt);
      } catch (aiError) {
        this.logger.warn(
          { traceId, conversationKey },
          `AI service call failed, notifying guest: ${aiError}`,
        );
        await this.messageSender.sendText(
          phoneNumberId,
          guestNumber,
          OVERWHELMED_MESSAGE,
        );
        return;
      }

      const { reservationIntent, reply } =
        this.extractReservationIntent(rawReply);

      if (resort && reservationIntent) {
        await this.tryCreateReservation(
          featureContext,
          guestNumber,
          reservationIntent,
          traceId,
        );
      }

      if (resort) {
        // Recorded first (as "Pending"); the actual WhatsApp send happens durably via
        // WA_SEND_QUEUE from within DeskService.recordMessage, so a bad/expired token
        // or a transient WhatsApp outage gets retried instead of silently dropping the
        // reply (and instead of failing this whole flush job).
        this.recordAiReplyForDesk(
          resort,
          guestNumber,
          reply,
          phoneNumberId,
          traceId,
        );
      } else {
        // No resort context to record this against on any desk — send directly so the
        // guest still gets an answer; best-effort, no delivery-status tracking here.
        await this.messageSender.sendText(phoneNumberId, guestNumber, reply);
      }

      // Only recorded once a reply was actually produced — the early returns above
      // (human-handled, cooldown, reservation confirm/decline) intentionally don't reach
      // here, so a silent bot doesn't pollute the transcript the next real turn replays.
      await this.appendToHistory(conversationKey, {
        role: 'guest',
        text: combined,
      });
      await this.appendToHistory(conversationKey, {
        role: 'assistant',
        text: reply,
      });

      await this.registerSessionMessage(
        conversationKey,
        phoneNumberId,
        guestNumber,
        traceId,
      );
      this.logger.info(
        { traceId, conversationKey },
        'Flush job completed — AI reply generated and handed off',
      );
    } catch (err) {
      this.logger.error(
        { traceId, conversationKey },
        `Error processing flush job: ${err}`,
      );
      await this.messageSender.sendText(
        phoneNumberId,
        guestNumber,
        SERVICE_UNAVAILABLE,
      );
      return;
    }
  }

  private async handleReservationConfirmationReply(
    resort: Resort,
    guestNumber: string,
    phoneNumberId: string,
    guestMessage: string,
    traceId: string,
  ): Promise<boolean> {
    const trimmed = guestMessage.trim();
    if (trimmed !== '1' && trimmed !== '2') {
      return false;
    }

    const pending = await this.reservationRepository.findLatestPendingForGuest(
      resort.id,
      guestNumber,
    );
    if (!pending) {
      return false;
    }

    if (trimmed === '1') {
      // Confirming is staff-only now (see ReservationService.updateStatus) —
      // this just acknowledges the guest without touching the reservation.
      this.logger.info(
        { traceId, reservationId: pending.id },
        `Guest acknowledged reservation for "${pending.feature.name}", awaiting staff confirmation`,
      );
      await this.messageSender.sendText(
        phoneNumberId,
        guestNumber,
        `Thanks! A member of our team will confirm your reservation for ${pending.feature.name} shortly.`,
      );
      return true;
    }

    // Withdrawing your own not-yet-confirmed request is the guest's call, no
    // staff involvement needed — unlike confirming. Pending never occupied a
    // unit, so there's nothing to push to Channex here.
    pending.status = ReservationStatus.DECLINED;
    await this.reservationRepository.save(pending);

    this.logger.info(
      { traceId, reservationId: pending.id, status: pending.status },
      `Guest cancelled their own pending reservation for "${pending.feature.name}"`,
    );
    await this.messageSender.sendText(
      phoneNumberId,
      guestNumber,
      `Your reservation for ${pending.feature.name} has been declined.`,
    );
    return true;
  }

  /**
   * Hands the AI's reply off to the desk to record (and durably deliver over WhatsApp). This
   * is an event, not a direct call — whoever's listening (DeskService) handles it independently
   * of this pipeline, so a listener failure can never bubble back into process()'s outer catch.
   */
  private recordAiReplyForDesk(
    resort: Resort | null,
    guestNumber: string,
    reply: string,
    phoneNumberId: string,
    traceId: string,
  ): void {
    if (!resort) {
      return;
    }
    const event: AiRepliedEvent = {
      resortId: resort.id,
      guestPhoneNumber: guestNumber,
      body: reply,
      sentAt: new Date().toISOString(),
      phoneNumberId,
      traceId,
    };
    this.eventEmitter.emit(DESK_EVENTS.AI_REPLIED, event);
  }

  private async isCoolingDown(conversationKey: string): Promise<boolean> {
    const cooling = await this.redis.get(this.cooldownKey(conversationKey));
    return cooling !== null;
  }

  private async registerSessionMessage(
    conversationKey: string,
    phoneNumberId: string,
    guestNumber: string,
    traceId: string,
  ): Promise<void> {
    const countKey = this.sessionCountKey(conversationKey);
    const count = await this.redis.incr(countKey);
    await this.redis.expire(countKey, COOLDOWN_SECONDS);

    if (count >= SESSION_MESSAGE_LIMIT) {
      await this.redis.set(
        this.cooldownKey(conversationKey),
        '1',
        'EX',
        COOLDOWN_SECONDS,
      );
      await this.redis.del(countKey);
      this.logger.debug(
        { traceId, conversationKey },
        'Conversation hit the session limit, cooling down',
      );
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

  private historyKey(conversationKey: string): string {
    return `wa:history:${conversationKey}`;
  }

  /** Prior turns for this conversation, oldest first — empty for a brand-new conversation or
   * one that's gone quiet past CONVERSATION_HISTORY_TTL_SECONDS. */
  private async getConversationHistory(
    conversationKey: string,
  ): Promise<ConversationTurn[]> {
    const raw = await this.redis.lrange(
      this.historyKey(conversationKey),
      0,
      -1,
    );
    return raw.map((entry) => JSON.parse(entry) as ConversationTurn);
  }

  private async appendToHistory(
    conversationKey: string,
    turn: ConversationTurn,
  ): Promise<void> {
    const key = this.historyKey(conversationKey);
    await this.redis.rpush(key, JSON.stringify(turn));
    // Keep only the most recent N turns — bounds the prompt size over a long-running
    // conversation instead of replaying its entire history forever.
    await this.redis.ltrim(key, -CONVERSATION_HISTORY_MAX_TURNS, -1);
    await this.redis.expire(key, CONVERSATION_HISTORY_TTL_SECONDS);
  }

  private async buildFeatureContext(
    resortId: string,
  ): Promise<FeatureAvailability[]> {
    const features = await this.resortFeatureRepository.find({
      where: { resort: { id: resortId }, isActive: true },
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    return Promise.all(
      features.map(async (feature) => {
        const [activeCount, periods] = await Promise.all([
          this.reservationRepository.countActiveForFeature(feature.id),
          this.ratePeriodRepository.findAllForFeature(feature.id),
        ]);
        return {
          feature,
          availability: Math.max(feature.quantity - activeCount, 0),
          rate: resolveRate(periods, today, feature.price),
        };
      }),
    );
  }

  private async tryCreateReservation(
    featureContext: FeatureAvailability[],
    guestNumber: string,
    intent: ReservationIntent,
    traceId: string,
  ): Promise<void> {
    const match = featureContext.find(
      (fc) => fc.feature.name.toLowerCase() === intent.feature.toLowerCase(),
    );
    if (!match) {
      this.logger.debug(
        { traceId },
        `AI referenced unknown feature "${intent.feature}"`,
      );
      return;
    }
    if (match.availability <= 0) {
      this.logger.debug(
        { traceId },
        `Feature "${match.feature.name}" has no availability, skipping reservation creation`,
      );
      return;
    }

    // Defense in depth: the prompt instructs the model to only ever emit the marker with
    // valid guest counts, but an LLM's output isn't a schema-validated input — `adults`/`kids`
    // are NOT NULL columns on Reservation, so a bad/missing value here must never reach
    // `save()` as a DB constraint violation. Skip (and let the guest be asked again) instead.
    if (
      !Number.isInteger(intent.adults) ||
      intent.adults < 1 ||
      !Number.isInteger(intent.kids) ||
      intent.kids < 0
    ) {
      this.logger.debug(
        { traceId, adults: intent.adults, kids: intent.kids },
        'AI reservation intent had invalid guest counts, skipping reservation creation',
      );
      return;
    }

    const reservation = this.reservationRepository.create({
      feature: match.feature,
      startDate: intent.start as unknown as Date,
      endDate: intent.end as unknown as Date,
      phoneNumber: guestNumber,
      adults: intent.adults,
      kids: intent.kids,
    });
    // Created as Pending, which doesn't occupy a unit or get pushed to
    // Channex — only staff-accepting it (via ReservationService.updateStatus)
    // does that. Multiple guests can be mid-conversation about the same last
    // unit at once; staff resolves the conflict by picking one to accept.
    await this.reservationRepository.save(reservation);
    this.logger.info(
      { traceId, reservationId: reservation.id, featureId: match.feature.id },
      'Reservation created from AI intent',
    );
  }

  private extractReservationIntent(rawReply: string): {
    reservationIntent: ReservationIntent | null;
    reply: string;
  } {
    // Strip unconditionally, whether or not the strict parse below succeeds — this marker is
    // for internal processing only and must never reach the guest, even a malformed one.
    const reply = rawReply.replace(RESERVATION_MARKER_STRIP_REGEX, '').trim();

    const match = rawReply.match(RESERVATION_MARKER_REGEX);
    if (!match) {
      return { reservationIntent: null, reply };
    }

    const [, feature, start, end, adultsRaw, kidsRaw] = match;
    return {
      reservationIntent: {
        feature,
        start,
        end,
        adults: Number(adultsRaw),
        kids: Number(kidsRaw),
      },
      reply,
    };
  }

  private buildPrompt(
    resort: Resort | null,
    guestMessage: string,
    featureContext: FeatureAvailability[],
    guestName: string,
    history: ConversationTurn[],
  ): string {
    const resortName = resort?.name ?? 'the resort';

    const faqSection = resort?.faqs?.length
      ? resort.faqs
          .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
          .join('\n\n')
      : 'No FAQs available.';

    const contactSection = resort?.contacts?.length
      ? resort.contacts
          .map(
            (contact) =>
              `${contact.contact_name} (${contact.type}): ${contact.contact}`,
          )
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
      `Guest's name (use this for "Name" in a reservation confirmation summary, if one is needed): ${guestName}`,
    ];

    if (history.length > 0) {
      const transcript = history
        .map(
          (turn) =>
            `${turn.role === 'guest' ? 'Guest' : 'Assistant'}: ${turn.text}`,
        )
        .join('\n');
      sections.push(
        `Conversation so far (oldest first — the guest's latest message is given separately below, do not treat it as already answered):`,
        transcript,
      );
    }

    sections.push(
      `Resort details:`,
      detailsSection,
      `Contacts — share the relevant contact when the guest needs to reach the resort directly:`,
      contactSection,
      `Use the following FAQs to answer the guest when relevant:`,
      faqSection,
    );

    if (featureContext.length > 0) {
      const featureSection = featureContext
        .map(({ feature, availability, rate }) => {
          const description = feature.description
            ? ` — ${feature.description}`
            : '';
          const policyNotes = [
            rate.stopSell
              ? 'currently not sellable (stop sell in effect)'
              : null,
            rate.minStay ? `${rate.minStay}-night minimum stay` : null,
            rate.closedToArrival
              ? 'not available as a check-in date today'
              : null,
            rate.closedToDeparture
              ? 'not available as a check-out date today'
              : null,
          ]
            .filter(Boolean)
            .join(', ');
          const policySuffix = policyNotes ? ` (${policyNotes})` : '';
          return `- ${feature.name}: price ${rate.price}, available ${availability}/${feature.quantity}${description}${policySuffix}`;
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
        `Bookable features and their current availability. Only mention prices when the guest explicitly asks about cost or pricing (except during the reservation confirmation summary below, where price is always shown):`,
        featureSection,
        `Today's date is ${todayIso} (${todayWeekday}), resort local time.`,
        `Reservation flow — five things are required before a booking can be confirmed: (1) the feature, (2) a start date, (3) an end date, (4) the number of adults, (5) the number of kids. Gather whichever of these you don't already have, one at a time, in natural conversation — never ask the guest to fill out a form or type values in a specific format. For dates: ask naturally (e.g. "What dates would you like to book?"), never ask for YYYY-MM-DD — guests answer in natural language ("next Friday", "for 2 nights starting Monday", etc.) and you work out the actual calendar dates yourself using today's date above. For guest counts: ask naturally (e.g. "How many adults and kids will be staying?") — kids must be explicitly stated as zero by the guest ("just the two of us", "no kids") before you treat it as zero; never silently assume no kids just because the guest didn't mention them.`,
        `Never guess or silently assume any date or guest-count detail the guest didn't state — always ask instead. In particular: (1) if the guest gives only one date with no indication of how many nights or when they'd leave, do not assume a single-day stay — ask when they'd like to check out or how many nights they're staying. (2) If the guest's own wording is internally contradictory or genuinely ambiguous about which dates they mean (for example "Friday next week until Monday next week", where a literal reading puts the Monday before the Friday), do not silently pick an interpretation — point out the contradiction and ask them to confirm. (3) If the guest gives a total number of guests without splitting adults vs. kids, ask them to split it out. (4) Nothing you weren't explicitly given and haven't confirmed with the guest may ever appear in the reservation marker below — if unsure of any of the five fields, ask rather than guess.`,
        `Once — and only once — all five fields are known, valid (adults is at least 1; kids is zero or more), and the feature still has availability remaining, record the request in two parts, in this exact order, both in the same reply: first a structured summary in exactly this layout (fill in the real values, keep the labels and line breaks exactly as shown, no extra commentary before or inside it):

Name: <guest's name>
Guests: <adults + kids>
Adults: <adults>
Kids: <kids>
Price: <feature's price>
Date: <start date> - <end date>

Reply 2 if you'd like to cancel this request — otherwise, a member of our team will confirm it and follow up with you shortly.

Then, on its own line immediately after, the internal marker (this line is for internal processing only — the guest should never be told about it or asked to produce it themselves): [RESERVE feature="<feature name>" start="<start date>" end="<end date>" adults="<adults>" kids="<kids>"]. Use the feature name exactly as written above, dates as YYYY-MM-DD, and adults/kids as plain integers. If the feature turns out to have no availability, tell the guest it's fully booked instead of producing a summary or marker.`,
      );
    }

    sections.push(`Guest message:`, guestMessage);

    return sections.join('\n\n');
  }
}
