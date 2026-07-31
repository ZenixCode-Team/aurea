import { PrismaClient } from '@prisma/client';
import { ambiente } from './ambiente.js';

export const prisma = new PrismaClient({
  log: ambiente.AMBIENTE === 'desenvolvimento' ? ['warn', 'error'] : ['error'],
});

export type Prisma = typeof prisma;
