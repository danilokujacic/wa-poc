import { Injectable } from '@nestjs/common';
import { DataSource, LessThan, Repository } from 'typeorm';
import { EmailConfirmation } from '../entity/email-confirmation.entity';

@Injectable()
export class EmailConfirmationRepository extends Repository<EmailConfirmation> {
  constructor(private readonly dataSource: DataSource) {
    super(EmailConfirmation, dataSource.createEntityManager());
  }

  findValidBySlug(slug: string): Promise<EmailConfirmation | null> {
    return this.findOne({
      where: { slug },
      relations: { user: true },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.delete({ expires: LessThan(new Date()) });
    return result.affected ?? 0;
  }
}
