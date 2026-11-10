import { describe, expect, it } from '@guchho/test';

import { createSpinner } from '../../src/cli/spinner.ts';
import { createCliStyle } from '../../src/cli/style.ts';

describe('cli spinner', () => {
  it('prints only final states when animation is disabled', () => {
    const output = createOutput();
    const spinner = createSpinner(
      output.writer,
      createCliStyle(false),
      false,
      'Building...',
    );

    spinner.start();
    expect(output.text()).toBe('');

    spinner.success('Built extension');
    expect(output.text()).toBe('✔ Built extension\n');

    spinner.error('Build failed');
    expect(output.text()).toBe('✔ Built extension\n✖ Build failed\n');
  });

  it('renders and clears frames when animation is enabled', () => {
    const output = createOutput();
    const spinner = createSpinner(
      output.writer,
      createCliStyle(true),
      true,
      'Building...',
    );

    spinner.start();
    expect(output.text()).toContain('\u001B[?25l');
    expect(output.text()).toContain('Building...');

    spinner.update('Still building...');
    expect(output.text()).toContain('Still building...');

    spinner.clear();
    expect(output.text()).toContain('\u001B[?25h');
  });
});

function createOutput(): {
  writer: { write(chunk: string): boolean };
  text: () => string;
} {
  let text = '';

  return {
    writer: {
      write(chunk: string) {
        text += chunk;
        return true;
      },
    },
    text: () => text,
  };
}
