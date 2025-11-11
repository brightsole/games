import http from 'node:http';
import { customAlphabet } from 'nanoid';
import { startController } from './gameController';
import { createRestApp } from './restHandler';
import env from './env';

// good ole motorCase
const nanoid = customAlphabet('brumBRUM', 24);

jest.mock('./gameController', () => ({
  startController: jest.fn(),
}));

// Mock dependencies for game controller
jest.mock('./env', () => ({
  __esModule: true,
  default: {
    hopsApiUrl: 'http://localhost:3001',
    adminUserId: 'admin-123',
    authHeaderName: 'x-internal-secret',
    authHeaderValue: 'test-secret-value-123',
  },
}));

global.fetch = jest.fn();

const mockStartController = jest.mocked(startController);

const createControllerDouble = (
  overrides: Partial<ReturnType<typeof startController>>,
): ReturnType<typeof startController> => ({
  create: jest.fn().mockRejectedValue('unexpected create'),
  getById: jest.fn().mockRejectedValue('unexpected getById'),
  query: jest.fn().mockRejectedValue('unexpected query'),
  update: jest.fn().mockRejectedValue('unexpected update'),
  ...overrides,
});

describe('REST handler', () => {
  it('creates a game without error', async () => {
    const create = jest.fn().mockResolvedValue({
      id: nanoid(),
      ownerIds: 'owner-1',
      wordsKey: 'cat|dog|fish',
      words: ['cat', 'dog', 'fish'],
      isDraft: true,
      looksNaughty: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockStartController.mockReturnValue(createControllerDouble({ create }));

    const app = createRestApp();
    const server = http.createServer(app);

    await new Promise<void>((resolve) => server.listen(0, resolve));

    const serverAddress = server.address();
    if (!serverAddress || typeof serverAddress === 'string')
      throw new Error('Server failed to start');

    const payload = JSON.stringify({
      words: ['cat', 'dog', 'fish'],
    });

    try {
      const response = await new Promise<{ status: number; body: string }>(
        (resolve, reject) => {
          const req = http.request(
            {
              hostname: '127.0.0.1',
              port: serverAddress.port,
              path: '/games',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'x-user-id': 'owner-1',
                [env.authHeaderName]: env.authHeaderValue,
              },
            },
            (res) => {
              const chunks: Buffer[] = [];
              res.on('data', (chunk) => chunks.push(chunk as Buffer));
              res.on('end', () =>
                resolve({
                  status: res.statusCode ?? 0,
                  body: Buffer.concat(chunks).toString('utf-8'),
                }),
              );
            },
          );

          req.on('error', reject);
          req.write(payload);
          req.end();
        },
      );

      expect(response.status).toBe(201);

      const data = JSON.parse(response.body);
      expect(data).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          ownerIds: 'owner-1',
          words: ['cat', 'dog', 'fish'],
          isDraft: true,
          looksNaughty: false,
        }),
      );
      expect(create).toHaveBeenCalledWith(
        {
          words: ['cat', 'dog', 'fish'],
        },
        'owner-1',
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
