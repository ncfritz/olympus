import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { CanonicalCalendarEvent } from '../../src/domain/canonical-event';
import { EVENT_STORE, EventStore } from '../../src/store/event-store';
import { issueE2eAccessToken } from './auth-fixtures';

function fixtureEvent(overrides: Partial<CanonicalCalendarEvent> = {}): CanonicalCalendarEvent {
  const uid = overrides.uid ?? 'uid-1';
  const source = overrides.source ?? 'test-source';
  return {
    id: `${source}:${uid}`,
    subject: 'Test event',
    sensitivity: 'normal',
    importance: 'normal',
    occurrenceType: 'single',
    type: 'appointment',
    reminder: false,
    response: 'accepted',
    startTime: '2026-01-05T15:00:00.000Z',
    endTime: '2026-01-05T15:30:00.000Z',
    duration: 30,
    allDay: false,
    status: 'busy',
    location: null,
    cancelled: false,
    organizerEmail: null,
    deleted: false,
    uid,
    recurrenceId: null,
    source,
    ...overrides,
  };
}

describe('Availability (e2e)', () => {
  let app: INestApplication;
  let store: EventStore;
  let authHeader: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    store = app.get(EVENT_STORE);
    authHeader = `Bearer ${issueE2eAccessToken(app)}`;
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects requests with no access token', () => {
    return request(app.getHttpServer())
      .get('/freebusy?start=2026-01-05T15:00:00.000Z&end=2026-01-05T16:00:00.000Z')
      .expect(401);
  });

  it('computes 15-minute slots for the requested range', async () => {
    await store.upsertEvent(
      fixtureEvent({ status: 'busy', startTime: '2026-01-05T15:15:00.000Z', endTime: '2026-01-05T15:45:00.000Z' }),
    );

    const res = await request(app.getHttpServer())
      .get('/freebusy?start=2026-01-05T15:00:00.000Z&end=2026-01-05T16:00:00.000Z')
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body.map((s: { status: string }) => s.status)).toEqual(['free', 'busy', 'busy', 'free']);
  });

  it('rejects a range where start is not before end', () => {
    return request(app.getHttpServer())
      .get('/freebusy?start=2026-01-05T16:00:00.000Z&end=2026-01-05T15:00:00.000Z')
      .set('Authorization', authHeader)
      .expect(400);
  });

  it('rejects a missing query parameter', () => {
    return request(app.getHttpServer())
      .get('/freebusy?start=2026-01-05T15:00:00.000Z')
      .set('Authorization', authHeader)
      .expect(400);
  });

  describe('/freebusy/timeline', () => {
    it('rejects requests with no access token', () => {
      return request(app.getHttpServer())
        .get('/freebusy/timeline?start=2026-01-05T15:00:00.000Z&end=2026-01-05T16:00:00.000Z')
        .expect(401);
    });

    it('computes a status per 15-minute chunk, keyed by minutes since epoch', async () => {
      await store.upsertEvent(
        fixtureEvent({ status: 'busy', startTime: '2026-01-05T15:15:00.000Z', endTime: '2026-01-05T15:45:00.000Z' }),
      );

      const res = await request(app.getHttpServer())
        .get('/freebusy/timeline?start=2026-01-05T15:00:00.000Z&end=2026-01-05T16:00:00.000Z')
        .set('Authorization', authHeader)
        .expect(200);

      const startMinutes = Date.parse('2026-01-05T15:00:00.000Z') / 60_000;
      expect(res.body).toEqual({
        [startMinutes]: 'free',
        [startMinutes + 15]: 'busy',
        [startMinutes + 30]: 'busy',
        [startMinutes + 45]: 'free',
      });
    });

    it('rejects a range where start is not before end', () => {
      return request(app.getHttpServer())
        .get('/freebusy/timeline?start=2026-01-05T16:00:00.000Z&end=2026-01-05T15:00:00.000Z')
        .set('Authorization', authHeader)
        .expect(400);
    });

    it('shows a synced meeting outside the default 08:00-18:00 UTC window as none', async () => {
      await store.upsertEvent(
        fixtureEvent({ status: 'busy', startTime: '2026-01-05T06:00:00.000Z', endTime: '2026-01-05T06:15:00.000Z' }),
      );

      const res = await request(app.getHttpServer())
        .get('/freebusy/timeline?start=2026-01-05T06:00:00.000Z&end=2026-01-05T06:15:00.000Z')
        .set('Authorization', authHeader)
        .expect(200);

      expect(Object.values(res.body)).toEqual(['none']);
    });

    it('honors custom dayStart/dayEnd query params', async () => {
      await store.upsertEvent(
        fixtureEvent({ status: 'busy', startTime: '2026-01-05T08:00:00.000Z', endTime: '2026-01-05T08:15:00.000Z' }),
      );

      const res = await request(app.getHttpServer())
        .get('/freebusy/timeline?start=2026-01-05T08:00:00.000Z&end=2026-01-05T08:15:00.000Z&dayStart=09:00&dayEnd=17:00')
        .set('Authorization', authHeader)
        .expect(200);

      expect(Object.values(res.body)).toEqual(['none']);
    });

    it('shows a weekend synced meeting as none unless treatWeekendsAsWorking is set', async () => {
      // 2026-01-03 is a Saturday.
      await store.upsertEvent(
        fixtureEvent({ status: 'busy', startTime: '2026-01-03T15:00:00.000Z', endTime: '2026-01-03T15:15:00.000Z' }),
      );

      const byDefault = await request(app.getHttpServer())
        .get('/freebusy/timeline?start=2026-01-03T15:00:00.000Z&end=2026-01-03T15:15:00.000Z')
        .set('Authorization', authHeader)
        .expect(200);
      expect(Object.values(byDefault.body)).toEqual(['none']);

      const treatedAsWorking = await request(app.getHttpServer())
        .get('/freebusy/timeline?start=2026-01-03T15:00:00.000Z&end=2026-01-03T15:15:00.000Z&treatWeekendsAsWorking=true')
        .set('Authorization', authHeader)
        .expect(200);
      expect(Object.values(treatedAsWorking.body)).toEqual(['busy']);
    });

    it('rejects a malformed dayStart', () => {
      return request(app.getHttpServer())
        .get('/freebusy/timeline?start=2026-01-05T15:00:00.000Z&end=2026-01-05T16:00:00.000Z&dayStart=not-a-time')
        .set('Authorization', authHeader)
        .expect(400);
    });

    it('honors the timezone query param', async () => {
      // 19:00 UTC on 2026-01-05 is 11:00 in America/Los_Angeles (UTC-8 in
      // January) — inside the default window there, outside it in UTC.
      await store.upsertEvent(
        fixtureEvent({ status: 'busy', startTime: '2026-01-05T19:00:00.000Z', endTime: '2026-01-05T19:15:00.000Z' }),
      );

      const res = await request(app.getHttpServer())
        .get('/freebusy/timeline?start=2026-01-05T19:00:00.000Z&end=2026-01-05T19:15:00.000Z&timezone=America/Los_Angeles')
        .set('Authorization', authHeader)
        .expect(200);

      expect(Object.values(res.body)).toEqual(['busy']);
    });

    it('rejects an unrecognized timezone', () => {
      return request(app.getHttpServer())
        .get('/freebusy/timeline?start=2026-01-05T15:00:00.000Z&end=2026-01-05T16:00:00.000Z&timezone=Not/AZone')
        .set('Authorization', authHeader)
        .expect(400);
    });
  });
});
