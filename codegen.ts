import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'src/typeDefs.ts',
  documents: ['!src/generated/**/*'],
  generates: {
    'src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        contextType: '../types#Context',
        useTypeImports: true,
        scalars: {
          DateTime: 'Date',
          JSONObject: 'Record<string, unknown>',
        },
        mappers: {
          Game: '../types#DBGame',
        },
        federation: true,
      },
    },
  },
  hooks: {},
};

export default config;
