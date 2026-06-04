import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AppService } from './../src/app.service';

describe('Docs service landing page (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AppService)
      .useValue({
        renderLandingPage: jest
          .fn()
          .mockResolvedValue(
            '<!doctype html><h1>Luyen Thi Lai Xe Microservices</h1>',
          ),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('content-type', /html/)
      .expect((response) => {
        expect(response.text).toContain('Luyen Thi Lai Xe Microservices');
      });
  });

  afterEach(async () => {
    await app?.close();
  });
});
