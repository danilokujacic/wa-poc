import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/test-app';
import { mockMetaSendSuccess, cleanupMetaMocks } from './utils/mock-meta';
import { ResortRepository } from '../src/repository/resort.repository';
import { ResortFeatureRepository } from '../src/repository/resort-feature.repository';
import { UserRole } from '../src/entity/user.entity';
import { JwtPayload } from '../src/auth/jwt-payload.interface';

// Accepting/declining a reservation asynchronously triggers a real WhatsApp
// notification send (ReservationService.updateStatus emits
// DESK_EVENTS.RESERVATION_STATUS_MESSAGE -> DeskService -> WA_SEND_QUEUE).
// That's a background job, not something the PATCH response waits on, so
// tests that trigger it need to give it a moment to settle before the app
// (and its DB connection) closes underneath it.
const settleAsyncSideEffects = () =>
  new Promise((resolve) => setTimeout(resolve, 800));

// Real Postgres, real TypeORM — the point of this suite is to exercise SQL
// behavior a mocked-repository unit test structurally cannot: the
// list-filter-pattern query operators (MoreThanOrEqual/ILike/etc actually
// filtering rows), the unique constraints, and the overbooking detection's
// live overlap query.
describe('Reservation DB integration (e2e)', () => {
  let app: INestApplication<App>;
  let close: () => Promise<void>;
  let jwtService: JwtService;
  let resortRepository: ResortRepository;
  let resortFeatureRepository: ResortFeatureRepository;

  let resortId: string;
  let featureId: string;
  let token: string;

  beforeAll(async () => {
    mockMetaSendSuccess();
    ({ app, close } = await createTestApp());
    jwtService = app.get(JwtService);
    resortRepository = app.get(ResortRepository);
    resortFeatureRepository = app.get(ResortFeatureRepository);

    const suffix = randomUUID();
    const resort = await resortRepository.save(
      resortRepository.create({
        name: `Integration Test Resort ${suffix}`,
        phoneNumber: `itest-${suffix}`,
      }),
    );
    resortId = resort.id;

    const feature = await resortFeatureRepository.save(
      resortFeatureRepository.create({
        name: 'Integration Test Room',
        price: 100,
        quantity: 1,
        capacity: 2,
        resort: { id: resortId } as never,
      }),
    );
    featureId = feature.id;

    const payload: JwtPayload = {
      sub: randomUUID(),
      email: `owner-${suffix}@example.com`,
      role: UserRole.OWNER,
      resortId,
    };
    token = jwtService.sign(payload);
  });

  afterAll(async () => {
    await close();
    cleanupMetaMocks();
  });

  it('persists a reservation and reads it back with the real query filters', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/resort/${resortId}/reservation`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        featureId,
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        phoneNumber: '38269000001',
        adults: 2,
        kids: 0,
      })
      .expect(201);

    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.status).toBe('Pending');

    // list-filter-pattern's default `from` is today — a reservation dated
    // 2026-09-01 must still show up as long as "today" in the test
    // environment is before that (true for the foreseeable future of this
    // suite), proving the MoreThanOrEqual(fromISO) filter is inclusive of
    // future-dated reservations, not just exactly-today ones.
    const listRes = await request(app.getHttpServer())
      .get(`/resort/${resortId}/reservation`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      listRes.body.some((r: { id: string }) => r.id === createRes.body.id),
    ).toBe(true);

    // Text-search filter (ILike) — partial, case-insensitive match on phone.
    const searchRes = await request(app.getHttpServer())
      .get(`/resort/${resortId}/reservation`)
      .query({ phoneNumber: '269000' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      searchRes.body.some((r: { id: string }) => r.id === createRes.body.id),
    ).toBe(true);

    const noMatchRes = await request(app.getHttpServer())
      .get(`/resort/${resortId}/reservation`)
      .query({ phoneNumber: 'no-such-number' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      noMatchRes.body.some((r: { id: string }) => r.id === createRes.body.id),
    ).toBe(false);
  });

  it('detects a live overbooking against the real DB once two reservations collide on a quantity-1 feature', async () => {
    const accept = (id: string) =>
      request(app.getHttpServer())
        .patch(`/resort/${resortId}/reservation/${id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'Accepted' })
        .expect(200);

    const create = (phoneNumber: string) =>
      request(app.getHttpServer())
        .post(`/resort/${resortId}/reservation`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          featureId,
          startDate: '2026-10-10',
          endDate: '2026-10-12',
          phoneNumber,
          adults: 1,
          kids: 0,
        })
        .expect(201);

    const first = await create('38269000002');
    const second = await create('38269000003');

    await accept(first.body.id);
    await accept(second.body.id);
    await settleAsyncSideEffects();

    const overbookedRes = await request(app.getHttpServer())
      .get(`/resort/${resortId}/reservation`)
      .query({ overbooked: 'true' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const overbookedIds = overbookedRes.body.map((r: { id: string }) => r.id);
    expect(overbookedIds).toEqual(
      expect.arrayContaining([first.body.id, second.body.id]),
    );

    // Resolving the conflict by declining one side makes the flag disappear
    // on the very next read — it's computed live, never stored.
    await request(app.getHttpServer())
      .patch(`/resort/${resortId}/reservation/${second.body.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Declined' })
      .expect(200);
    await settleAsyncSideEffects();

    const resolvedRes = await request(app.getHttpServer())
      .get(`/resort/${resortId}/reservation/${first.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(resolvedRes.body.isOverbooked).toBe(false);
  });

  it('rejects a reservation request for a resort the token holder does not belong to', async () => {
    await request(app.getHttpServer())
      .get(`/resort/${randomUUID()}/reservation`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
