import type { Diagnostic } from '../core/errors.ts';
import type { BuildMode, EntrypointKind, SourcemapOption } from '../core/types.ts';

export type BundlerFormat = 'iife' | 'esm';

export interface BundlerEntrypoint {
  name: string;
  input: string;
  output: string;
  kind: EntrypointKind;
}

export interface BundlerTransform {
  name: string;
  include?: (id: string) => boolean;
  transform(
    code: string,
    id: string,
  ): string | null | Promise<string | null>;
}

export interface BundlerBuildInput {
  root: string;
  outdir: string;
  mode: BuildMode;
  entrypoints: readonly BundlerEntrypoint[];
  transforms?: readonly BundlerTransform[];
  format?: BundlerFormat;
  bundle?: boolean;
  splitting?: boolean;
  treeShaking?: boolean;
  minify?: boolean;
  minifyHtml?: boolean;
  sourcemap?: SourcemapOption;
  target?: string | readonly string[];
  define?: Readonly<Record<string, string>>;
  alias?: Readonly<Record<string, string>>;
  external?: readonly string[];
  loader?: Readonly<Record<string, string>>;
  metafile?: boolean;
  write?: boolean;
}

export interface BundlerOutput {
  path: string;
  size: number;
}

export interface BundlerInput {
  path: string;
  bytes: number;
}

export interface BundlerBuildResult {
  success: boolean;
  duration: number;
  outputs: readonly BundlerOutput[];
  inputs: readonly BundlerInput[];
  errors: readonly Diagnostic[];
  warnings: readonly Diagnostic[];
  metafile?: unknown;
}

export interface BundlerContext {
  rebuild(): Promise<BundlerBuildResult>;
  dispose(): Promise<void>;
}

export interface BundlerAdapter {
  readonly name: string;
  readonly version: string;
  build(input: BundlerBuildInput): Promise<BundlerBuildResult>;
  createContext?(input: BundlerBuildInput): Promise<BundlerContext>;
  dispose?(): Promise<void>;
}
