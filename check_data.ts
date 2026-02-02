import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== AI Agents ===');
  const agents = await prisma.agent.findMany();
  console.log('Count:', agents.length);
  agents.forEach(a => console.log(' -', a.name, a.status));

  console.log('\n=== Posts ===');
  const posts = await prisma.post.findMany();
  console.log('Count:', posts.length);

  console.log('\n=== Submolts ===');
  const submolts = await prisma.submolt.findMany();
  console.log('Count:', submolts.length);
  submolts.forEach(s => console.log(' -', s.name, s.display_name));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
