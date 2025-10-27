import { startController } from './gameController';
import resolvers from './resolvers';
import type { DBGame, Context } from './types';
import type { GraphQLResolveInfo } from 'graphql';

const defaultGame = {
  id: 'bRUMbrumBRUM',
  ownerIds: 'owner-123',
  wordsKey: 'cat|dog|fish',
  words: ['cat', 'dog', 'fish'],
  isDraft: true,
  looksNaughty: false,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
} as unknown as DBGame;

const createGameControllerMock = (
  overrides: Partial<ReturnType<typeof startController>> = {},
): ReturnType<typeof startController> => ({
  getById: jest.fn().mockResolvedValue(undefined),
  listByOwner: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue(defaultGame),
  update: jest.fn().mockResolvedValue(defaultGame),
  ...overrides,
});

// Mock GraphQL info object
const mockInfo = {} as GraphQLResolveInfo;

// Helper to call resolver whether it's a function or has a resolve property
/* eslint-disable @typescript-eslint/no-explicit-any */
const callResolver = async (
  resolver: any,
  parent: any,
  args: any,
  context: any,
) => {
  if (typeof resolver === 'function') {
    return resolver(parent, args, context, mockInfo);
  }
  if (resolver?.resolve) {
    return resolver.resolve(parent, args, context, mockInfo);
  }
  throw new Error('Invalid resolver type');
};

describe('Resolvers', () => {
  describe('Query', () => {
    it('fetches a game given an id', async () => {
      const gameController = createGameControllerMock({
        getById: jest.fn().mockResolvedValue(defaultGame),
      });

      const context: Context = {
        gameController,
        event: {},
      };

      const game = await callResolver(
        resolvers.Query!.game!,
        {},
        { id: 'bRUMbrumBRUM' },
        context,
      );

      expect(game).toEqual(defaultGame);
      expect(gameController.getById).toHaveBeenCalledWith('bRUMbrumBRUM');
    });

    it('returns null for an unknown game', async () => {
      const gameController = createGameControllerMock({
        getById: jest.fn().mockResolvedValue(undefined),
      });

      const context: Context = {
        gameController,
        event: {},
      };

      const game = await callResolver(
        resolvers.Query!.game!,
        {},
        { id: 'nonexistent' },
        context,
      );

      expect(game).toBeUndefined();
    });

    it('lists games for an owner', async () => {
      const results = [
        {
          ...defaultGame,
          id: 'game1',
          ownerIds: 'you|other',
        },
        {
          ...defaultGame,
          id: 'game2',
          ownerIds: 'you',
        },
      ] as unknown as DBGame[];

      const gameController = createGameControllerMock({
        listByOwner: jest.fn().mockResolvedValue(results),
      });

      const context: Context = {
        gameController,
        event: {},
      };

      const games = await callResolver(
        resolvers.Query!.games!,
        {},
        { query: { ownerId: 'you' } },
        context,
      );

      expect(games).toEqual(results);
      expect(gameController.listByOwner).toHaveBeenCalledWith('you');
    });
  });

  describe('Mutation', () => {
    it('creates a game when given valid words', async () => {
      const create = jest.fn().mockResolvedValue(defaultGame);
      const gameController = createGameControllerMock({ create });

      const context: Context = {
        gameController,
        event: {},
        ownerId: 'owner-123',
      };

      const game = await callResolver(
        resolvers.Mutation!.submitGame!,
        {},
        { words: ['cat', 'dog', 'fish'] },
        context,
      );

      expect(game).toEqual(defaultGame);
      expect(create).toHaveBeenCalledWith(
        { words: ['cat', 'dog', 'fish'] },
        'owner-123',
      );
    });

    it('propagates create errors', async () => {
      const create = jest.fn().mockRejectedValue(new Error('Unauthorized'));
      const gameController = createGameControllerMock({ create });

      const context: Context = {
        gameController,
        event: {},
      };

      await expect(
        callResolver(
          resolvers.Mutation!.submitGame!,
          {},
          { words: ['cat', 'dog'] },
          context,
        ),
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('Game field resolvers', () => {
    it('resolves words field to Word objects', async () => {
      const parent = { words: ['cat', 'dog', 'fish'] };
      const context: Context = {
        gameController: createGameControllerMock(),
        event: {},
      };

      const words = await callResolver(
        resolvers.Game!.words!,
        parent,
        {},
        context,
      );

      expect(words).toEqual([
        { __typename: 'Word', id: 'cat' },
        { __typename: 'Word', id: 'dog' },
        { __typename: 'Word', id: 'fish' },
      ]);
    });

    it('resolves owners field to User objects', async () => {
      const parent = { ownerIds: 'owner1|owner2|owner3' };
      const context: Context = {
        gameController: createGameControllerMock(),
        event: {},
      };

      const owners = await callResolver(
        resolvers.Game!.owners!,
        parent,
        {},
        context,
      );

      expect(owners).toEqual([
        { __typename: 'User', id: 'owner1' },
        { __typename: 'User', id: 'owner2' },
        { __typename: 'User', id: 'owner3' },
      ]);
    });

    it('resolves reference to game', async () => {
      const gameController = createGameControllerMock({
        getById: jest.fn().mockResolvedValue(defaultGame),
      });

      // __resolveReference has different signature: (reference, context)
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const resolveRef = resolvers.Game!.__resolveReference! as (
        reference: { id: string },
        context: { gameController: any },
      ) => Promise<DBGame>;
      /* eslint-enable @typescript-eslint/no-explicit-any */

      const game = await resolveRef({ id: 'bRUMbrumBRUM' }, { gameController });

      expect(game).toEqual(defaultGame);
      expect(gameController.getById).toHaveBeenCalledWith('bRUMbrumBRUM');
    });
  });
});
