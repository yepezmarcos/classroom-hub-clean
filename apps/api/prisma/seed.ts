// apps/api/prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureTenant() {
  const existing = await prisma.tenant.findFirst().catch(() => null);
  if (existing) return existing;

  try {
    return await prisma.tenant.create({
      data: { id: 'default', name: 'Default' },
    });
  } catch {
    return await prisma.tenant.create({ data: { name: 'Default' } });
  }
}

async function ensureSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
  if (existing) return existing;

  return prisma.settings.create({
    data: {
      id: 'singleton',
      jurisdiction: null,
      board: null,
      terms: 3,
      subjects: [],
      gradeBands: [],
      lsCategories: []
    }
  });
}

async function main() {
  const tenant = await ensureTenant();
  console.log('Tenant ready:', tenant?.id ?? tenant);

  const settings = await ensureSettings();
  console.log('Settings ready:', settings?.id);

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });