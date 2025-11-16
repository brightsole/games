import type { ModelType, DBGame } from './types';
import { Query as QueryType } from 'dynamoose/dist/ItemRetriever';

jest.mock('bad-words', () => ({
  Filter: jest.fn().mockImplementation(() => ({
    isProfane: jest.fn().mockReturnValue(false),
  })),
}));

jest.mock('./sanitize', () => ({
  normalizeWord: jest.fn((word: string) => word.toLowerCase()),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;
global.fetch = mockFetch;

type GameModelMock = jest.Mocked<ModelType & QueryType<DBGame>>;

let createGameController: (typeof import('./gameController'))['createGameController'];

beforeEach(async () => {
  jest.resetModules();
  jest.clearAllMocks();
  ({ createGameController } = await import('./gameController'));
});

const createGameModelMock = (
  overrides: Partial<GameModelMock> = {},
): GameModelMock => {
  return {
    get: jest.fn().mockReturnThis(),
    scan: jest.fn().mockReturnThis(),
    query: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    using: jest.fn().mockReturnThis(),
    exec: jest.fn().mockReturnThis(),
    create: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    ...overrides,
  } as GameModelMock;
};

const defaultGame = {
  id: 'bRUMbrumBRUM',
  ownerIds: 'owner-123',
  wordsKey: 'cat|dog|fish',
  words: ['cat', 'dog', 'fish'],
  status: 'draft',
  looksNaughty: false,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
} as unknown as DBGame;

describe('game controller', () => {
  describe('.getById(gameId): Game', () => {
    it('fetches a game given an id', async () => {
      const Game = createGameModelMock({
        get: jest.fn().mockResolvedValue(defaultGame),
      });

      const game = await createGameController(Game).getById('bRUMbrumBRUM');
      expect(game).toEqual(defaultGame);
    });

    it('returns a cached game without hitting the database twice', async () => {
      const Game = createGameModelMock({
        get: jest.fn().mockResolvedValue(defaultGame),
      });

      const controller = createGameController(Game);
      const first = await controller.getById('bRUMbrumBRUM');
      const second = await controller.getById('bRUMbrumBRUM');

      expect(first).toEqual(defaultGame);
      expect(second).toEqual(first);
      expect(Game.get).toHaveBeenCalledTimes(1);
    });

    it('returns undefined when fetching something nonexistent', async () => {
      const Game = createGameModelMock({
        get: jest.fn().mockResolvedValue(undefined),
      });

      const game = await createGameController(Game).getById('nonexistent');
      expect(game).toEqual(undefined);
    });
  });

  describe('.query(ownerId): Game[]', () => {
    it('fetches all games containing a given ownerId', async () => {
      const Game = createGameModelMock({
        exec: jest.fn().mockResolvedValue([
          { ...defaultGame, id: 'game1' },
          { ...defaultGame, id: 'game2' },
        ]),
      });

      const games = await createGameController(Game).query({
        ownerId: 'owner-123',
      });
      expect(games).toEqual([
        { ...defaultGame, id: 'game1' },
        { ...defaultGame, id: 'game2' },
      ]);
      expect(Game.scan).toHaveBeenCalledWith({
        ownerIds: { contains: 'owner-123' },
      });
    });

    it('returns nothing if it is given an unused ownerId', async () => {
      const Game = createGameModelMock({
        exec: jest.fn().mockResolvedValue([]),
      });

      const games = await createGameController(Game).query({
        ownerId: 'someguy',
      });
      expect(games).toEqual([]);
    });
  });

  describe('.query(query): Game[]', () => {
    it('uses performant GSI query when publishMonth is provided', async () => {
      const Game = createGameModelMock({
        exec: jest.fn().mockResolvedValue([
          { ...defaultGame, id: 'game1', publishMonth: '2024-01' },
          { ...defaultGame, id: 'game2', publishMonth: '2024-01' },
        ]),
      });

      const games = await createGameController(Game).query({
        publishMonth: '2024-01',
      });

      expect(games).toEqual([
        { ...defaultGame, id: 'game1', publishMonth: '2024-01' },
        { ...defaultGame, id: 'game2', publishMonth: '2024-01' },
      ]);
      expect(Game.query).toHaveBeenCalledWith('publishMonth');
      expect(Game.eq).toHaveBeenCalledWith('2024-01');
      expect(Game.using).toHaveBeenCalledWith('publishMonth');
    });

    it('falls back to scan when no publishMonth provided', async () => {
      const Game = createGameModelMock({
        exec: jest.fn().mockResolvedValue([{ ...defaultGame, id: 'game1' }]),
      });

      const games = await createGameController(Game).query({
        ownerId: 'owner-123',
      });

      expect(games).toEqual([{ ...defaultGame, id: 'game1' }]);
      expect(Game.scan).toHaveBeenCalledWith({
        ownerIds: { contains: 'owner-123' },
      });
    });

    it('returns empty array when no games match publishMonth', async () => {
      const Game = createGameModelMock({
        exec: jest.fn().mockResolvedValue([]),
      });

      const games = await createGameController(Game).query({
        publishMonth: '2025-12',
      });

      expect(games).toEqual([]);
    });
  });

  describe('.create(input, ownerId): Game', () => {
    it('creates a new game when no existing game found', async () => {
      const Game = createGameModelMock({
        exec: jest.fn().mockResolvedValue([]), // no existing game
        create: jest.fn().mockResolvedValue(defaultGame),
      });

      // Mock fetch to reject all hops API calls (no direct links)
      mockFetch.mockRejectedValue(new Error('No link found'));

      const game = await createGameController(Game).create(
        { words: ['cat', 'dog', 'fish'] },
        'owner-123',
      );

      expect(game).toEqual(defaultGame);
      expect(Game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          ownerIds: 'owner-123',
          wordsKey: 'cat|dog|fish',
          words: ['cat', 'dog', 'fish'],
          status: 'draft',
          looksNaughty: false,
        }),
        { overwrite: false },
      );
    });

    it('joins an existing game when found and has space', async () => {
      const existingGame = {
        ...defaultGame,
        ownerIds: 'owner-1',
        status: 'draft' as const,
      };
      const updatedGame = {
        ...existingGame,
        ownerIds: 'owner-1|owner-123',
        status: 'draft' as const,
      };

      const Game = createGameModelMock({
        exec: jest.fn().mockResolvedValue([existingGame]),
        update: jest.fn().mockResolvedValue(updatedGame),
      });

      const game = await createGameController(Game).create(
        { words: ['cat', 'dog', 'fish'] },
        'owner-123',
      );

      expect(game).toEqual(updatedGame);
      expect(Game.update).toHaveBeenCalledWith(
        { id: existingGame.id },
        {
          ownerIds: 'owner-1|owner-123',
          status: 'draft',
        },
        { returnValues: 'ALL_NEW' },
      );
    });

    it('sets status to ready and adds READY- publishMonth when third owner joins', async () => {
      const existingGame = {
        ...defaultGame,
        ownerIds: 'owner-1|owner-2',
        status: 'draft' as const,
      };
      const updatedGame = {
        ...existingGame,
        ownerIds: 'owner-1|owner-2|owner-123',
        status: 'ready' as const,
        publishMonth: expect.stringMatching(/^READY-\d+$/),
      };

      const Game = createGameModelMock({
        exec: jest.fn().mockResolvedValue([existingGame]),
        update: jest.fn().mockResolvedValue(updatedGame),
      });

      const game = await createGameController(Game).create(
        { words: ['cat', 'dog', 'fish'] },
        'owner-123',
      );

      expect(game).toEqual(updatedGame);
      expect(Game.update).toHaveBeenCalledWith(
        { id: existingGame.id },
        {
          ownerIds: 'owner-1|owner-2|owner-123',
          status: 'ready',
          publishMonth: expect.stringMatching(/^READY-\d+$/),
        },
        { returnValues: 'ALL_NEW' },
      );
    });

    it('returns existing game when it has 3 owners already', async () => {
      const fullGame = {
        ...defaultGame,
        ownerIds: 'owner-1|owner-2|owner-3',
        status: 'ready' as const,
      };

      const Game = createGameModelMock({
        exec: jest.fn().mockResolvedValue([fullGame]),
      });

      const game = await createGameController(Game).create(
        { words: ['cat', 'dog', 'fish'] },
        'owner-123',
      );

      expect(game).toEqual(fullGame);
      expect(Game.update).not.toHaveBeenCalled();
      expect(Game.create).not.toHaveBeenCalled();
    });

    it('throws error when words are directly linked', async () => {
      const Game = createGameModelMock({
        exec: jest.fn().mockResolvedValue([]), // no existing game
      });

      // Mock fetch to return success for one of the pairs (indicating direct link)
      mockFetch.mockResolvedValueOnce({ ok: true });

      await expect(
        createGameController(Game).create(
          { words: ['cat', 'dog', 'fish'] },
          'owner-123',
        ),
      ).rejects.toThrow("Can't create, word pairs directly linked");
    });

    it('explodes if not logged in', async () => {
      const Game = createGameModelMock();

      await expect(
        createGameController(Game).create({ words: ['cat', 'dog'] }),
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('.update(id, input, userId): Game', () => {
    it('updates a game when user is admin', async () => {
      const Game = createGameModelMock({
        update: jest.fn().mockResolvedValue({
          ...defaultGame,
          status: 'published',
        }),
      });

      const game = await createGameController(Game).update(
        'bRUMbrumBRUM',
        { status: 'published' },
        'test-guy',
      );

      expect(game).toEqual({ ...defaultGame, status: 'published' });
      expect(Game.update).toHaveBeenCalledWith(
        { id: 'bRUMbrumBRUM' },
        { status: 'published' },
        expect.objectContaining({ returnValues: 'ALL_NEW' }),
      );
    });

    it('throws error when user is not admin', async () => {
      const Game = createGameModelMock();

      await expect(
        createGameController(Game).update(
          'bRUMbrumBRUM',
          { status: 'published' },
          'regular-user',
        ),
      ).rejects.toThrow('Only admin can update games');
    });

    it('throws error when no user provided', async () => {
      const Game = createGameModelMock();

      await expect(
        createGameController(Game).update(
          'bRUMbrumBRUM',
          { status: 'published' },
          undefined,
        ),
      ).rejects.toThrow('Only admin can update games');
    });
  });
});
