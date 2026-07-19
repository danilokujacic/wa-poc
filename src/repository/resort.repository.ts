import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Resort } from '../entity/resort.entity';

@Injectable()
export class ResortRepository extends Repository<Resort> {
    constructor(private readonly dataSource: DataSource) {
        super(Resort, dataSource.createEntityManager());
    }

    findByPhoneNumberWithCore(phoneNumber: string): Promise<Resort | null> {
        return this.findOne({
            where: { phoneNumber },
            relations: { faqs: true, contacts: true },
        });
    }
}
