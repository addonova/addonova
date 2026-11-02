import { defineConfig } from '@guchho/test';

export default defineConfig({
  include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
  environment: 'node',
});
