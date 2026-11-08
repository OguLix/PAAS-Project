import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import dotenv from 'dotenv';
import argon2 from 'argon2';
import { createPrismaClient } from '@ogulix/shared/server/prisma';
import { emailSchema, passwordSchema } from '@ogulix/shared';

const envPaths = [resolve(process.cwd(), '.env')];
if (basename(process.cwd()) === 'backend') {
  envPaths.push(resolve(process.cwd(), '..', '.env'));
}
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

type SeedNode = {
  name: string;
  host: string;
  sshPort: number;
  capacityCpuMillicores: number;
  capacityMemoryMb: number;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required seed environment variable: ${name}`);
  }
  return value;
}

function integerEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function nodeConfig(index: 1 | 2): SeedNode {
  const prefix = `SEED_NODE_${index}`;
  return {
    name: process.env[`${prefix}_NAME`]?.trim() || `mock-node-${index}`,
    host: process.env[`${prefix}_HOST`]?.trim() || '127.0.0.1',
    sshPort: integerEnv(`${prefix}_SSH_PORT`, 22, 1, 65535),
    capacityCpuMillicores: integerEnv(`${prefix}_CPU_MILLICORES`, 2000, 100, 64000),
    capacityMemoryMb: integerEnv(`${prefix}_MEMORY_MB`, 2048, 128, 262144),
  };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing to seed a production database without SEED_ALLOW_PRODUCTION=true');
  }

  const databaseUrl = required('DATABASE_URL');
  const email = emailSchema.parse(required('SEED_ADMIN_EMAIL'));
  const password = passwordSchema.parse(required('SEED_ADMIN_PASSWORD'));
  const resetPassword = process.env.SEED_ADMIN_RESET_PASSWORD === 'true';
  const nodes = [nodeConfig(1), nodeConfig(2)];

  const prisma = createPrismaClient(databaseUrl);
  try {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const admin = await prisma.user.upsert({
      where: { email },
      update: resetPassword ? { role: 'ADMIN', passwordHash } : { role: 'ADMIN' },
      create: { email, passwordHash, role: 'ADMIN' },
    });

    for (const node of nodes) {
      await prisma.runtimeNode.upsert({
        where: { name: node.name },
        update: {
          host: node.host,
          sshPort: node.sshPort,
          status: 'ONLINE',
          capacityCpuMillicores: node.capacityCpuMillicores,
          capacityMemoryMb: node.capacityMemoryMb,
          lastHeartbeatAt: new Date(),
        },
        create: {
          ...node,
          status: 'ONLINE',
          lastHeartbeatAt: new Date(),
        },
      });
    }

    console.log(
      `Seed complete: admin=${admin.email}, nodes=${nodes.map((node) => node.name).join(', ')}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Seed failed');
  process.exitCode = 1;
});
