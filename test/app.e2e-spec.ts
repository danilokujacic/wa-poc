import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/test-app';

// Basic boot smoke test: the app wires up its full module graph (real DB,
// real Redis/BullMQ) and the HTTP layer responds.
//
// This used to assert `GET /` returns "Hello World!" — that route was never
// actually implemented (there is no AppController in src/, only an unused
// AppService.getHello()), so the original test had been asserting a
// nonexistent feature since the project's initial commit. Repointed at a
// route that's real instead.
describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ app, close } = await createTestApp());
  });

  afterAll(async () => {
    await close();
  });

  it('boots the full module graph and serves a real route', async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'test_verify_token';

    await request(app.getHttpServer())
      .get('/whatsapp')
      .query({
        'hub.challenge': 'smoke-test-challenge',
        'hub.verify_token': 'test_verify_token',
      })
      .expect(200)
      .expect('smoke-test-challenge');
  });

  it('404s an unmapped route', async () => {
    await request(app.getHttpServer()).get('/this-route-does-not-exist').expect(404);
  });
});
