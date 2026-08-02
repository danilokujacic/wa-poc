import { DataSource } from 'typeorm';
import { ResortFeatureRepository } from './resort-feature.repository';

describe('ResortFeatureRepository', () => {
  it('constructs with the entity manager from the provided data source', () => {
    const createEntityManager = jest.fn().mockReturnValue({});
    const dataSource = { createEntityManager } as unknown as DataSource;

    const repository = new ResortFeatureRepository(dataSource);

    expect(createEntityManager).toHaveBeenCalled();
    expect(repository).toBeInstanceOf(ResortFeatureRepository);
    expect(repository.target).toBeDefined();
  });
});
