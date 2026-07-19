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
    entities: [join(__dirname, '**/entity/*.entity{.ts,.js}')],
    migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
});
