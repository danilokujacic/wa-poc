import { UserRepository } from './user.repository';

function createRepository(): UserRepository {
  return new UserRepository({ createEntityManager: () => ({}) } as any);
}

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeEach(() => {
    repository = createRepository();
  });

  describe('findByEmail', () => {
    it('looks up a user by email with the resort relation', async () => {
      const user = { id: 'user-1', email: 'a@b.com' };
      const findOneSpy = jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue(user as any);

      const result = await repository.findByEmail('a@b.com');

      expect(findOneSpy).toHaveBeenCalledWith({
        where: { email: 'a@b.com' },
        relations: { resort: true },
      });
      expect(result).toBe(user);
    });

    it('returns null when no user matches the email', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      const result = await repository.findByEmail('missing@b.com');

      expect(result).toBeNull();
    });
  });
});
