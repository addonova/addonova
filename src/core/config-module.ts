import { createJiti } from 'jiti';

import { AddonovaError } from './errors.ts';

export interface LoadConfigModuleOptions {
  code: string;
  message: string;
  suggestion: string;
}

export async function loadConfigModule(
  filePath: string,
  options: LoadConfigModuleOptions,
): Promise<unknown> {
  const jiti = createJiti(import.meta.url, {
    fsCache: false,
    moduleCache: false,
    interopDefault: true,
  });

  try {
    return await jiti.import<unknown>(filePath, { default: true });
  } catch (error) {
    throw new AddonovaError({
      code: options.code,
      severity: 'error',
      message: `${options.message}: ${filePath}`,
      location: { file: filePath },
      suggestion: options.suggestion,
      cause: error,
    });
  }
}
