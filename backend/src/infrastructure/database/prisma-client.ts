import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

export function createPrismaClient(databaseUrl: string): PrismaClient {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== 'mysql:' || !parsed.hostname || !parsed.pathname.slice(1)) {
    throw new Error('DATABASE_URL must be a MariaDB mysql:// connection URL');
  }

  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.slice(1)),
    connectionLimit: 5,
  });

  return new PrismaClient({ adapter });
}
