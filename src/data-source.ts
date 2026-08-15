import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? 'devpass',
  database: process.env.DB_NAME ?? 'wa_poc',
  // Same reasoning as app.module.ts's TypeOrmModule config — Neon requires
  // SSL, local docker-compose Postgres doesn't have it set up, so this must
  // stay opt-in via DB_SSL rather than always-on.
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [join(__dirname, '**/entity/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
});
