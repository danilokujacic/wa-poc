import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Faq } from '../entity/faq.entity';

@Injectable()
export class FaqRepository extends Repository<Faq> {
    constructor(private readonly dataSource: DataSource) {
        super(Faq, dataSource.createEntityManager());
    }
}
