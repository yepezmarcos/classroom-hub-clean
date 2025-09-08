import { PrismaClient } from '@prisma/client';
import { saveDev } from '../fallback/dev-store';

export async function seedDev() {
  // write to fallback file (visible immediately)
  saveDev({}); // ensures .data/dev.json exists
  // try to insert basic tenants/classes/students if models exist
  const prisma = new PrismaClient();
  try {
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({ data: { name: 'Default School' } });
    }
    const clsCount = await prisma.classroom.count();
    if (clsCount === 0) {
      await prisma.classroom.createMany({
        data: [
          { name: 'Homeroom A', code: 'HRA-24' },
          { name: 'Math A', code: 'MATH-5A' },
        ],
        skipDuplicates: true,
      });
    }
    const stuCount = await prisma.student.count();
    if (stuCount === 0) {
      await prisma.student.createMany({
        data: [
          { first: 'Alex', last: 'Rivera' },
          { first: 'Jess', last: 'Kim' },
          { first: 'Sam', last: 'Chen' },
        ],
        skipDuplicates: true,
      });
    }
  } catch {
    // ignore if models/tables aren’t there yet
  } finally {
    await prisma.$disconnect();
  }
}