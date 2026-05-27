import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true })
  app.setGlobalPrefix('api')
  await app.listen(3001)
  console.log('API is running on port 3001')
}
bootstrap()
