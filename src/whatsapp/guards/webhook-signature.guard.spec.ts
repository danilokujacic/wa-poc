import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { WebhookSignatureGuard } from './webhook-signature.guard';

function contextWith(headers: Record<string, string>, rawBody?: Buffer) {
    return {
        switchToHttp: () => ({
            getRequest: () => ({ headers, rawBody }),
        }),
    } as any;
}

describe('WebhookSignatureGuard', () => {
    let guard: WebhookSignatureGuard;
    const originalSecret = process.env.WHATSAPP_APP_SECRET;
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        guard = new WebhookSignatureGuard();
        process.env.WHATSAPP_APP_SECRET = 'test-app-secret';
        // The guard skips verification entirely outside production (to allow
        // Postman-style manual testing in dev) — force production here so
        // these tests actually exercise the signature-checking logic.
        process.env.NODE_ENV = 'production';
    });

    afterAll(() => {
        process.env.WHATSAPP_APP_SECRET = originalSecret;
        process.env.NODE_ENV = originalNodeEnv;
    });

    it('skips verification outside production', () => {
        process.env.NODE_ENV = 'development';
        const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }));

        expect(guard.canActivate(contextWith({}, rawBody))).toBe(true);
    });

    it('accepts a request signed with the correct app secret', () => {
        const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }));
        const signature = `sha256=${createHmac('sha256', 'test-app-secret').update(rawBody).digest('hex')}`;

        expect(guard.canActivate(contextWith({ 'x-hub-signature-256': signature }, rawBody))).toBe(true);
    });

    it('rejects a request with an invalid signature', () => {
        const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }));

        expect(() =>
            guard.canActivate(contextWith({ 'x-hub-signature-256': 'sha256=wrong' }, rawBody)),
        ).toThrow(UnauthorizedException);
    });

    it('rejects a request with a missing signature header', () => {
        const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }));

        expect(() => guard.canActivate(contextWith({}, rawBody))).toThrow(UnauthorizedException);
    });

    it('rejects a request with no raw body captured', () => {
        const signature = `sha256=${createHmac('sha256', 'test-app-secret').update('').digest('hex')}`;

        expect(() =>
            guard.canActivate(contextWith({ 'x-hub-signature-256': signature }, undefined)),
        ).toThrow(UnauthorizedException);
    });

    it('rejects when WHATSAPP_APP_SECRET is not configured', () => {
        delete process.env.WHATSAPP_APP_SECRET;
        const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }));

        expect(() =>
            guard.canActivate(contextWith({ 'x-hub-signature-256': 'sha256=anything' }, rawBody)),
        ).toThrow(UnauthorizedException);
    });
});
