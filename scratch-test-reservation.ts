import 'dotenv/config';
import { MessageFlushProcessor } from './src/bullmq/messages/messages.processor';
import { GeminiAiClient } from './src/ai/gemini-ai.client';
import { AiService } from './src/ai/ai.service';

const TEST_CASES: { label: string; guestMessage: string }[] = [
    {
        label: 'VALID: explicit date range, cross-month',
        guestMessage: "I'm interested in the Private Cabana.\nI want to book on 16. july until 30 of september.",
    },
    {
        label: 'VALID: relative weekday + week-later',
        guestMessage: "I'm interested in the Private Cabana.\nI want to book friday next week and i stay until monday week later.",
    },
    {
        label: 'WRONG: past date range (yesterday until today)',
        guestMessage: "I'm interested in the Private Cabana.\nI want to book it yesterday until todayy",
    },
    {
        label: 'WRONG: only one date given, no end date',
        guestMessage: "I'm interested in the Private Cabana.\nI wawnt to book it on july 27th",
    },
    {
        label: 'WRONG: end date before start date (Friday next week until Monday next week)',
        guestMessage: "I'm interested in the Private Cabana.\nI want to book it on friday next week until monday next week",
    },
];

async function main() {
    const geminiClient = new GeminiAiClient();
    const logger = { trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {} } as any;
    const aiService = new AiService(geminiClient, logger);

    const resort = {
        id: 'resort-1',
        name: 'Sunset Bay Resort',
        address: 'Paradise Beach bb, 85310 Budva, Montenegro',
        startWorkingHours: '08:00',
        endWorkingHours: '22:00',
        website: 'https://sunsetbayresort.example.com',
        faqs: [],
        contacts: [],
    } as any;

    const feature = { id: 'feature-1', name: 'Private Cabana', description: 'A private beachfront cabana for two, with sun loungers and shade.', price: 49.99, quantity: 6 } as any;

    const resortFeatureRepository = { find: async () => [feature] } as any;
    const reservationRepository = { countActiveForFeature: async () => 1 } as any;
    const resortContextService = {} as any;
    const producer = {} as any;
    const messageSender = {} as any;
    const redis = { get: async () => null, incr: async () => 1, expire: async () => undefined, set: async () => undefined, del: async () => undefined } as any;

    const processor = new MessageFlushProcessor(
        producer,
        aiService,
        resortContextService,
        resortFeatureRepository,
        reservationRepository,
        messageSender,
        redis,
        logger,
    );

    const featureContext = await (processor as any).buildFeatureContext(resort.id);

    for (const testCase of TEST_CASES) {
        console.log('\n' + '='.repeat(80));
        console.log(`CASE: ${testCase.label}`);
        console.log(`GUEST SAYS:\n${testCase.guestMessage}`);
        console.log('-'.repeat(80));

        const prompt = (processor as any).buildPrompt(resort, testCase.guestMessage, featureContext);
        const rawReply = await aiService.generateReply('Test Guest', prompt);
        const { reservationIntent, reply } = (processor as any).extractReservationIntent(rawReply);

        console.log('REPLY TO GUEST:');
        console.log(reply);
        console.log('-'.repeat(80));
        console.log('PARSED MARKER:', reservationIntent ?? '(none — no reservation marker emitted)');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
