import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  // No eager $connect(): Prisma connects lazily on the first query. An eager
  // connection at boot made Render cold-starts slow and fragile (the instance
  // couldn't serve anything until the Supabase pooler accepted a connection).
  // With lazy connect the app boots and passes Render's health check
  // immediately; the pool is established on the first real query.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
