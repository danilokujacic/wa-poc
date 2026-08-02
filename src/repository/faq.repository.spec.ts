import { DataSource } from 'typeorm';
import { FaqRepository } from './faq.repository';

describe('FaqRepository', () => {
  it('constructs with the entity manager from the provided data source', () => {
    const createEntityManager = jest.fn().mockReturnValue({});
    const dataSource = { createEntityManager } as unknown as DataSource;

    const repository = new FaqRepository(dataSource);

    expect(createEntityManager).toHaveBeenCalled();
    expect(repository).toBeInstanceOf(FaqRepository);
    expect(repository.target).toBeDefined();
  });
});
