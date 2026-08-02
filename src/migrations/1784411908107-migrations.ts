import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1784411908107 implements MigrationInterface {
  name = 'Migrations1784411908107';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "resort" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "phoneNumber" character varying NOT NULL, CONSTRAINT "UQ_23b3fd4785cc952c887a5171d37" UNIQUE ("phoneNumber"), CONSTRAINT "PK_3ffd8452901535c70454d5fb38c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "faq" ("id" SERIAL NOT NULL, "question" character varying NOT NULL, "answer" character varying NOT NULL, "resortId" uuid, CONSTRAINT "PK_d6f5a52b1a96dd8d0591f9fbc47" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "faq" ADD CONSTRAINT "FK_fb84b24d16cb97f26bed9f34e43" FOREIGN KEY ("resortId") REFERENCES "resort"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "faq" DROP CONSTRAINT "FK_fb84b24d16cb97f26bed9f34e43"`,
    );
    await queryRunner.query(`DROP TABLE "faq"`);
    await queryRunner.query(`DROP TABLE "resort"`);
  }
}
