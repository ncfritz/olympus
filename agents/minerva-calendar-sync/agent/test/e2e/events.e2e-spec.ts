import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { CanonicalCalendarEvent } from '../../src/domain/canonical-event';
import { EVENT_STORE, EventStore } from '../../src/store/event-store';

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

describe('Events (e2e)', () => {
  let app: INestApplication;
  let store: EventStore;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    store = app.get(EVENT_STORE);
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /events lists stored events and supports filtering', async () => {
    await store.upsertEvent(fixtureEvent({ uid: 'a' }));
    await store.upsertEvent(fixtureEvent({ uid: 'b', cancelled: true }));

    const all = await request(app.getHttpServer()).get('/events').expect(200);
    expect(all.body).toHaveLength(2);

    const cancelledOnly = await request(app.getHttpServer()).get('/events?cancelled=true').expect(200);
    expect(cancelledOnly.body.map((e: { uid: string }) => e.uid)).toEqual(['b']);
  });

  it('GET /events/:source/:uid returns the matching event', async () => {
    await store.upsertEvent(fixtureEvent({ uid: 'a', subject: 'Find me' }));

    const res = await request(app.getHttpServer()).get('/events/test-source/a').expect(200);
    expect(res.body.subject).toBe('Find me');
  });

  it('GET /events/:source/:uid 404s for an unknown event', () => {
    return request(app.getHttpServer()).get('/events/nope/nope').expect(404);
  });

  it('rejects a non-numeric limit', () => {
    return request(app.getHttpServer()).get('/events?limit=abc').expect(400);
  });

  it('rejects an unknown query parameter', () => {
    return request(app.getHttpServer()).get('/events?bogus=1').expect(400);
  });
});
