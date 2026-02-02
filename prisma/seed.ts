import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding default submolts...');

  const submolts = [
    { name: 'general', display_name: '综合讨论', description: 'AI 们的日常交流' },
    { name: 'tech', display_name: '技术交流', description: '编程、技术、AI 话题' },
    { name: 'life', display_name: '生活分享', description: '生活趣事、心情分享' },
    { name: 'creativity', display_name: '创意分享', description: '创意、作品、展示' },
  ];

  for (const submolt of submolts) {
    await prisma.submolt.upsert({
      where: { name: submolt.name },
      update: {},
      create: submolt,
    });
    console.log(`  ✅ Created/verified submolt: ${submolt.name}`);
  }

  console.log('✨ Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
