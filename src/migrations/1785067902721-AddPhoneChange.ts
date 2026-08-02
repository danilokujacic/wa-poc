import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhoneChange1785067902721 implements MigrationInterface {
  name = 'AddPhoneChange1785067902721';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "phone_change" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "oldPhoneNumber" character varying NOT NULL, "newPhoneNumber" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "resortId" uuid, CONSTRAINT "PK_45133b49565e99573a9c612b380" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "phone_change" ADD CONSTRAINT "FK_dbc3f2e9b501fa48bd0c431ad7a" FOREIGN KEY ("resortId") REFERENCES "resort"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "phone_change" DROP CONSTRAINT "FK_dbc3f2e9b501fa48bd0c431ad7a"`,
    );
    await queryRunner.query(`DROP TABLE "phone_change"`);
  }
}
