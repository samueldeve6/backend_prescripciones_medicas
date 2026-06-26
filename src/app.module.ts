import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { PrescriptionsModule } from './prescriptions/prescriptions.module.js';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, PrescriptionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
