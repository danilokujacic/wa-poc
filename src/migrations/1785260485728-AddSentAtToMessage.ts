import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSentAtToMessage1785260485728 implements MigrationInterface {
  name = 'AddSentAtToMessage1785260485728';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message" ADD "sentAt" TIMESTAMP WITH TIME ZONE`,
    );
    // Backfill existing rows: we don't have the original WhatsApp/AI send time for them,
    // so createdAt (insertion time) is the best available approximation.
    await queryRunner.query(
      `UPDATE "message" SET "sentAt" = "createdAt" WHERE "sentAt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "message" ALTER COLUMN "sentAt" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "sentAt"`);
  }
}
