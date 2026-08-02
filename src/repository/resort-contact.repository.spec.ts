import { DataSource } from 'typeorm';
import { ResortContactRepository } from './resort-contact.repository';

describe('ResortContactRepository', () => {
  it('constructs with the entity manager from the provided data source', () => {
    const createEntityManager = jest.fn().mockReturnValue({});
    const dataSource = { createEntityManager } as unknown as DataSource;

    const repository = new ResortContactRepository(dataSource);

    expect(createEntityManager).toHaveBeenCalled();
    expect(repository).toBeInstanceOf(ResortContactRepository);
    expect(repository.target).toBeDefined();
  });
});
