import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

export type PrismaClientOptions = {
  connectionLimit?: number;
};

/**
 * Server-only Prisma factory used by the API, worker and seed script.
 * The adapter is explicit because the Prisma schema uses the MariaDB driver.
 */
export function createPrismaClient(
  databaseUrl: string,
  options: PrismaClientOptions = {},
): PrismaClient {
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
    connectionLimit: options.connectionLimit ?? 5,
  });

  return new PrismaClient({ adapter });
}
