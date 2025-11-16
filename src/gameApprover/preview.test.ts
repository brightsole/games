import type { ModelType, DBGame } from '../types';
import { Query as QueryType } from 'dynamoose/dist/ItemRetriever';

type GameModelMock = jest.Mocked<ModelType & QueryType<DBGame>>;

let scheduleGamesHandler: (typeof import('./preview'))['scheduleGamesHandler'];

beforeEach(async () => {
  jest.resetModules();
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  ({ scheduleGamesHandler } = await import('./preview'));
});

afterEach(() => {
  jest.restoreAllMocks();
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
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    attributes: jest.fn().mockReturnThis(),
    ...overrides,
  } as unknown as GameModelMock;
};

const createGame = (overrides: Partial<DBGame> = {}): DBGame => {
  return {
    id: 'game-123',
    status: 'published',
    ownerIds: 'owner1|owner2|owner3',
    wordsKey: 'cat|dog|fish',
    words: ['cat', 'dog', 'fish'],
    looksNaughty: true,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    ...overrides,
  } as DBGame;
};

describe('scheduleGames handler', () => {
  describe('happy path', () => {
    it('schedules all games backwards from today regardless of status', async () => {
      const game1 = createGame({
        id: 'game1',
        status: 'ready',
        looksNaughty: false,
      });
      const game2 = createGame({
        id: 'game2',
        status: 'published',
        looksNaughty: true,
      });
      const game3 = createGame({
        id: 'game3',
        status: 'draft',
        looksNaughty: false,
      });

      const GameModel = createGameModelMock({
        scan: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([game1, game2, game3]),
        update: jest.fn().mockResolvedValue({}),
      });

      const result = await scheduleGamesHandler(GameModel);

      expect(result.statusCode).toBe(200);
      expect(result.scheduled).toBe(3);
      expect(result.gameIds).toEqual(['game1', 'game2', 'game3']);
      expect(GameModel.update).toHaveBeenCalledTimes(3);

      // Verify first game is today
      const firstCall = (GameModel.update as jest.Mock).mock.calls[0];
      expect(firstCall[0]).toEqual({ id: 'game1' });
      expect(firstCall[1]).toHaveProperty('publishDate');
      expect(firstCall[1]).toHaveProperty('publishMonth');
      expect(firstCall[1].status).toBe('published');

      const firstDate = new Date(firstCall[1].publishDate);
      const now = new Date();
      const today = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      expect(firstDate.getTime()).toBe(today.getTime());

      // Verify second game is yesterday
      const secondCall = (GameModel.update as jest.Mock).mock.calls[1];
      const secondDate = new Date(secondCall[1].publishDate);
      const daysDiff =
        (firstDate.getTime() - secondDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBe(1);

      // Verify third game is day before yesterday
      const thirdCall = (GameModel.update as jest.Mock).mock.calls[2];
      const thirdDate = new Date(thirdCall[1].publishDate);
      const daysDiff2 =
        (firstDate.getTime() - thirdDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff2).toBe(2);
    });

    it('formats publishMonth correctly', async () => {
      const game = createGame({
        id: 'game1',
      });

      const GameModel = createGameModelMock({
        scan: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([game]),
        update: jest.fn().mockResolvedValue({}),
      });

      await scheduleGamesHandler(GameModel);

      const updateCall = (GameModel.update as jest.Mock).mock.calls[0];
      const publishMonth = updateCall[1].publishMonth;

      // Should match YYYY-MM format
      expect(publishMonth).toMatch(/^\d{4}-\d{2}$/);
    });

    it('publishes games spanning month boundaries correctly', async () => {
      // Create 5 games to test month boundary
      const games = Array.from({ length: 5 }, (_, i) =>
        createGame({ id: `game${i + 1}` }),
      );

      const GameModel = createGameModelMock({
        scan: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(games),
        update: jest.fn().mockResolvedValue({}),
      });

      await scheduleGamesHandler(GameModel);

      // Check that all dates have proper month formatting
      const calls = (GameModel.update as jest.Mock).mock.calls;
      calls.forEach((call) => {
        const publishMonth = call[1].publishMonth;
        const publishDate = new Date(call[1].publishDate);
        const expectedMonth = `${publishDate.getUTCFullYear()}-${String(publishDate.getUTCMonth() + 1).padStart(2, '0')}`;
        expect(publishMonth).toBe(expectedMonth);
      });
    });
  });

  describe('unhappy path / edge cases', () => {
    it('returns early when no games exist in preview table', async () => {
      const GameModel = createGameModelMock({
        scan: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([]),
        update: jest.fn(),
      });

      const result = await scheduleGamesHandler(GameModel);

      expect(result.statusCode).toBe(200);
      expect(result.scheduled).toBe(0);
      expect(result.message).toBe('No games found in preview table');
      expect(GameModel.update).not.toHaveBeenCalled();
    });
  });
});
