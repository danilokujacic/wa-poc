import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { REDIS_CLIENT } from '../redis/redis.provider';
import { ResortRepository } from '../repository/resort.repository';
import { Resort } from '../entity/resort.entity';

const RESORT_CONTEXT_CACHE_TTL_SECONDS = 300;

@Injectable()
export class ResortContextService {
    constructor(
        private readonly resortRepository: ResortRepository,
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        @InjectPinoLogger(ResortContextService.name) private readonly logger: PinoLogger,
    ) { }

    /**
     * Best-effort pre-warm, meant to be called as soon as a message arrives
     * (before the debounce window), so it's already cached by the time the
     * flush processor needs it. Never throws — a warm-up failure shouldn't
     * break message ingestion; the processor will just fetch it itself later.
     */
    async warm(conversationKey: string, phoneNumberId: string): Promise<void> {
        try {
            await this.get(conversationKey, phoneNumberId);
        } catch (err) {
            this.logger.error(`Error warming resort context for ${conversationKey}: ${err}`);
        }
    }

    async get(conversationKey: string, phoneNumberId: string): Promise<Resort | null> {
        const cacheKey = this.cacheKey(conversationKey);

        const cached = await this.redis.get(cacheKey);
        if (cached) {
            await this.redis.expire(cacheKey, RESORT_CONTEXT_CACHE_TTL_SECONDS);
            return JSON.parse(cached) as Resort;
        }

        const resort = await this.resortRepository.findByPhoneNumberWithCore(phoneNumberId);
        if (resort) {
            await this.redis.set(cacheKey, JSON.stringify(resort), 'EX', RESORT_CONTEXT_CACHE_TTL_SECONDS);
        }
        return resort;
    }

    private cacheKey(conversationKey: string): string {
        return `wa:resort-context:${conversationKey}`;
    }
}
