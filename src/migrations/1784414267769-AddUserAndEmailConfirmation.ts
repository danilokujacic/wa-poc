import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserAndEmailConfirmation1784414267769 implements MigrationInterface {
    name = 'AddUserAndEmailConfirmation1784414267769'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum" AS ENUM('Owner', 'Employee')`);
        await queryRunner.query(`CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "password" character varying NOT NULL, "email" character varying NOT NULL, "role" "public"."user_role_enum" NOT NULL, "emailConfirmed" boolean NOT NULL DEFAULT false, "resortId" uuid, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "email_confirmation" ("id" SERIAL NOT NULL, "slug" character varying NOT NULL, "code" character varying NOT NULL, "expires" TIMESTAMP NOT NULL, "userId" uuid, CONSTRAINT "UQ_03477ebd2e20e4fc7b8741a5f86" UNIQUE ("slug"), CONSTRAINT "PK_ff2b80a46c3992a0046b07c5456" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_bd5f9fcc9a646e0787cb02b868c" FOREIGN KEY ("resortId") REFERENCES "resort"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "email_confirmation" ADD CONSTRAINT "FK_28d3d3fbd7503f3428b94fd18cc" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email_confirmation" DROP CONSTRAINT "FK_28d3d3fbd7503f3428b94fd18cc"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_bd5f9fcc9a646e0787cb02b868c"`);
        await queryRunner.query(`DROP TABLE "email_confirmation"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
    }

}
