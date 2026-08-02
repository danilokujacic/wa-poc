import { ResortRepository } from './resort.repository';

function createRepository(): ResortRepository {
  return new ResortRepository({ createEntityManager: () => ({}) } as any);
}

describe('ResortRepository', () => {
  let repository: ResortRepository;

  beforeEach(() => {
    repository = createRepository();
  });

  describe('findByPhoneNumberWithCore', () => {
    it('looks up a resort by phone number with faqs and contacts relations', async () => {
      const resort = { id: 'resort-1', phoneNumber: '+123' };
      const findOneSpy = jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue(resort as any);

      const result = await repository.findByPhoneNumberWithCore('+123');

      expect(findOneSpy).toHaveBeenCalledWith({
        where: { phoneNumber: '+123' },
        relations: { faqs: true, contacts: true },
      });
      expect(result).toBe(resort);
    });

    it('returns null when no resort matches the phone number', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      const result = await repository.findByPhoneNumberWithCore('+000');

      expect(result).toBeNull();
    });
  });
});
