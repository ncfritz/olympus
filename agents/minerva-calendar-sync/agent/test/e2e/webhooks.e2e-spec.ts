import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

// The full "a real channel triggers SyncEngine" path is covered by
// WebhookNotifier's own unit tests against a fake CalendarProvider — doing
// that here would need a live Google-registered channel, which needs real
// network access this test suite deliberately never touches. What's left
// to verify at this layer is the HTTP surface itself: it must be reachable
// with no access token (Google can't present one), and must never 500 on
// a handshake or an unrecognized channel.
describe('Webhooks (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts a notification with no access token', () => {
    return request(app.getHttpServer())
      .post('/webhooks/google')
      .set('x-goog-channel-id', 'chan-1')
      .set('x-goog-resource-state', 'exists')
      .expect(200);
  });

  it('accepts the initial "sync" handshake with no channel id', () => {
    return request(app.getHttpServer()).post('/webhooks/google').set('x-goog-resource-state', 'sync').expect(200);
  });

  it('accepts a notification for an unrecognized channel without error', () => {
    return request(app.getHttpServer())
      .post('/webhooks/google')
      .set('x-goog-channel-id', 'never-registered')
      .set('x-goog-resource-state', 'exists')
      .set('x-goog-channel-token', 'anything')
      .expect(200);
  });
});
