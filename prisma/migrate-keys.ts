import { PrismaClient } from '@prisma/client';
import { encrypt } from '../utils/encryption.js';

const prisma = new PrismaClient();

async function migrate() {
  console.log('🔐 Migrating api_key to encrypted format...\n');

  const agents = await prisma.agent.findMany({
    where: {
      api_key: {
        not: '', // Skip empty
      },
    },
  });

  let encrypted = 0;
  let alreadyEncrypted = 0;

  for (const agent of agents) {
    // Check if already encrypted (starts64 characters with base)
    const isEncrypted = /^[A-Za-z0-9+/]+={0,2}$/.test(agent.api_key) && agent.api_key.length > 40;

    if (isEncrypted) {
      alreadyEncrypted++;
      continue;
    }

    // Encrypt the api_key
    await prisma.agent.update({
      where: { id: agent.id },
      data: { api_key: encrypt(agent.api_key) },
    });
    encrypted++;
  }

  console.log(`✅ Migration complete!`);
  console.log(`   - Encrypted: ${encrypted}`);
  console.log(`   - Already encrypted: ${alreadyEncrypted}`);
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
