import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

// A never-real account label: SyncEngine's fire-and-forget attempt to
// resolve it fails fast on a missing local credential file (no network
// call), which is fine — these tests only assert on the HTTP response.
const FAKE_CALENDAR = {
  provider: 'google',
  accountLabel: 'e2e-fake-account',
  calendarId: 'cal-e2e',
  source: 'e2e-source',
};

describe('Calendars (e2e)', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('GET /calendars returns the configured calendars with sync status', async () => {
    process.env.SYNCED_CALENDARS = JSON.stringify([FAKE_CALENDAR]);
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    const res = await request(app.getHttpServer()).get('/calendars').expect(200);
    expect(res.body).toEqual([{ ...FAKE_CALENDAR, synced: false }]);
  });

  it('GET /calendars returns an empty list when nothing is configured', async () => {
    process.env.SYNCED_CALENDARS = '[]';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    const res = await request(app.getHttpServer()).get('/calendars').expect(200);
    expect(res.body).toEqual([]);
  });

  it('POST /calendars/:calendarId/sync 404s for an unconfigured calendar', async () => {
    process.env.SYNCED_CALENDARS = '[]';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    await request(app.getHttpServer()).post('/calendars/unknown/sync').expect(404);
  });

  it('POST /calendars/:calendarId/sync accepts a configured calendar', async () => {
    process.env.SYNCED_CALENDARS = JSON.stringify([FAKE_CALENDAR]);
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    await request(app.getHttpServer()).post(`/calendars/${FAKE_CALENDAR.calendarId}/sync`).expect(202);
  });
});
