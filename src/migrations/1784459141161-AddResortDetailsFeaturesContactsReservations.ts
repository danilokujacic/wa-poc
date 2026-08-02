import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResortDetailsFeaturesContactsReservations1784459141161 implements MigrationInterface {
  name = 'AddResortDetailsFeaturesContactsReservations1784459141161';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "resort_feature" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "price" double precision NOT NULL, "quantity" integer NOT NULL, "images" text array, "resortId" uuid, CONSTRAINT "PK_a58129548e4a7c09d0a69408762" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."resort_contact_type_enum" AS ENUM('Phone', 'Email')`,
    );
    await queryRunner.query(
      `CREATE TABLE "resort_contact" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "contact_name" character varying NOT NULL, "type" "public"."resort_contact_type_enum" NOT NULL, "contact" character varying NOT NULL, "resortId" uuid, CONSTRAINT "PK_86afa6f46a607a9ea7ce3e59320" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reservation_status_enum" AS ENUM('Pending', 'Accepted', 'Declined', 'Progress', 'Finished')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reservation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."reservation_status_enum" NOT NULL DEFAULT 'Pending', "startDate" date NOT NULL, "endDate" date NOT NULL, "phoneNumber" character varying NOT NULL, "otherContact" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "featureId" uuid, CONSTRAINT "PK_48b1f9922368359ab88e8bfa525" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort" ADD "address" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort" ADD "latitude" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort" ADD "longitude" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort" ADD "startWorkingHours" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort" ADD "endWorkingHours" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort" ADD "website" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort_feature" ADD CONSTRAINT "FK_649faf507f7642dffde32f11deb" FOREIGN KEY ("resortId") REFERENCES "resort"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort_contact" ADD CONSTRAINT "FK_b65ae26ea1cdfa46cefedc3f4e1" FOREIGN KEY ("resortId") REFERENCES "resort"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation" ADD CONSTRAINT "FK_d26416e673f1a548dfad44482b9" FOREIGN KEY ("featureId") REFERENCES "resort_feature"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservation" DROP CONSTRAINT "FK_d26416e673f1a548dfad44482b9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort_contact" DROP CONSTRAINT "FK_b65ae26ea1cdfa46cefedc3f4e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort_feature" DROP CONSTRAINT "FK_649faf507f7642dffde32f11deb"`,
    );
    await queryRunner.query(`ALTER TABLE "resort" DROP COLUMN "website"`);
    await queryRunner.query(
      `ALTER TABLE "resort" DROP COLUMN "endWorkingHours"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resort" DROP COLUMN "startWorkingHours"`,
    );
    await queryRunner.query(`ALTER TABLE "resort" DROP COLUMN "longitude"`);
    await queryRunner.query(`ALTER TABLE "resort" DROP COLUMN "latitude"`);
    await queryRunner.query(`ALTER TABLE "resort" DROP COLUMN "address"`);
    await queryRunner.query(`DROP TABLE "reservation"`);
    await queryRunner.query(`DROP TYPE "public"."reservation_status_enum"`);
    await queryRunner.query(`DROP TABLE "resort_contact"`);
    await queryRunner.query(`DROP TYPE "public"."resort_contact_type_enum"`);
    await queryRunner.query(`DROP TABLE "resort_feature"`);
  }
}
