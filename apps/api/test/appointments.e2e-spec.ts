import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from './../src/app.module'

/**
 * End-to-end: boot the real AppModule (global ClerkAuthGuard + RoleGuard wired
 * via APP_GUARD, real PrismaService connection) and assert that the
 * livekit-token route is protected. We mirror main.ts's global prefix so the
 * path matches production. No Clerk token or seed data is required — the auth
 * guard rejects before any DB/Clerk call, which is exactly the boundary we want
 * to prove is wired end-to-end.
 */
describe('Appointments livekit-token (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 401 without an Authorization header', () => {
    return request(app.getHttpServer())
      .get('/api/appointments/any-id/livekit-token')
      .expect(401)
  })

  it('returns 401 for a malformed Authorization header', () => {
    return request(app.getHttpServer())
      .get('/api/appointments/any-id/livekit-token')
      .set('Authorization', 'NotBearer xyz')
      .expect(401)
  })

  it('returns 401 for a bogus Bearer token', () => {
    return request(app.getHttpServer())
      .get('/api/appointments/any-id/livekit-token')
      .set('Authorization', 'Bearer not-a-real-jwt')
      .expect(401)
  })
})
