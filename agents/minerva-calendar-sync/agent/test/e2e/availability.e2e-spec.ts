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
});
