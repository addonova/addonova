import { analyzeProject } from '../../core/analyze.ts';
import type { ProjectAnalysis } from '../../core/analyze.ts';
import type { CommandContext } from '../command.ts';
import { formatBytes, getCliStyle, SYMBOLS } from '../style.ts';

export async function analyzeCommand(context: CommandContext): Promise<number> {
  const analyses = await analyzeProject(context.config);

  if (context.options.json) {
    context.io.stdout.write(
      `${JSON.stringify(analyses.map(toJsonAnalysis), null, 2)}\n`,
    );
    return 0;
  }

  const style = getCliStyle(context.io);

  for (const analysis of analyses) {
    context.io.stdout.write(
      `${style.green(SYMBOLS.success)} Analyzed ${style.cyan(
        analysis.browser.target,
      )} MV${analysis.browser.manifestVersion} (${style.dim(
        formatBytes(analysis.totalBytes),
      )})\n`,
    );

    for (const output of analysis.outputs) {
      context.io.stdout.write(
        `  ${output.path} ${style.dim(formatBytes(output.size))}\n`,
      );
    }

    const dependencyLabel =
      analysis.dependencies.length === 0
        ? 'none'
        : analysis.dependencies.join(', ');

    context.io.stdout.write(
      `  ${style.dim('Inputs')} ${analysis.inputs.length}  ${style.dim(
        'Dependencies',
      )} ${dependencyLabel}\n`,
    );
  }

  return 0;
}

function toJsonAnalysis(analysis: ProjectAnalysis): Readonly<Record<string, unknown>> {
  return {
    browser: analysis.browser.target,
    manifestVersion: analysis.browser.manifestVersion,
    outdir: analysis.outdir,
    totalBytes: analysis.totalBytes,
    dependencies: analysis.dependencies,
    inputs: analysis.inputs,
    outputs: analysis.outputs,
  };
}
