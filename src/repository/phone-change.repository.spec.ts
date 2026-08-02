import { MoreThanOrEqual } from 'typeorm';
import { PhoneChangeRepository } from './phone-change.repository';

describe('PhoneChangeRepository', () => {
  let repository: PhoneChangeRepository;

  beforeEach(() => {
    repository = new PhoneChangeRepository({
      createEntityManager: () => ({}),
    } as any);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  it('findRecentForResort queries findOne with the resort id and since-date filter', async () => {
    const findOneSpy = jest
      .spyOn(repository, 'findOne')
      .mockResolvedValue(null);
    const since = new Date('2026-01-01T00:00:00.000Z');

    const result = await repository.findRecentForResort('resort-1', since);

    expect(findOneSpy).toHaveBeenCalledWith({
      where: { resort: { id: 'resort-1' }, createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'DESC' },
    });
    expect(result).toBeNull();
  });
});
