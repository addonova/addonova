import type { CliWriter } from './command.ts';
import { SYMBOLS } from './style.ts';
import type { CliStyle } from './style.ts';

export interface Spinner {
  start(text?: string): Spinner;
  update(text: string): Spinner;
  clear(): Spinner;
  stop(text?: string): Spinner;
  success(text?: string): Spinner;
  error(text?: string): Spinner;
}

const FRAMES = [
  '⠋',
  '⠙',
  '⠹',
  '⠸',
  '⠼',
  '⠴',
  '⠦',
  '⠧',
  '⠇',
  '⠏',
] as const;

const FRAME_INTERVAL = 80;

export function createSpinner(
  writer: CliWriter,
  style: CliStyle,
  enabled: boolean,
  initialText = '',
): Spinner {
  let text = initialText;
  let frame = 0;
  let timer: NodeJS.Timeout | null = null;

  const render = (): void => {
    const symbol = FRAMES[frame % FRAMES.length] ?? FRAMES[0];
    writer.write(`\r${style.cyan(symbol)} ${text}\u001B[K`);
  };

  const spinner: Spinner = {
    start(startText) {
      if (startText !== undefined) {
        text = startText;
      }

      if (!enabled || timer !== null) {
        return spinner;
      }

      frame = 0;
      writer.write('\u001B[?25l');
      render();
      timer = setInterval(() => {
        frame += 1;
        render();
      }, FRAME_INTERVAL);

      return spinner;
    },

    update(nextText) {
      text = nextText;

      if (timer !== null) {
        render();
      }

      return spinner;
    },

    clear() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
        writer.write('\r\u001B[K');
        writer.write('\u001B[?25h');
      }

      return spinner;
    },

    stop(finalText) {
      spinner.clear();

      if (finalText !== undefined && finalText !== '') {
        writer.write(`${finalText}\n`);
      }

      return spinner;
    },

    success(finalText) {
      return spinner.stop(
        `${style.green(SYMBOLS.success)} ${finalText ?? text}`,
      );
    },

    error(finalText) {
      return spinner.stop(`${style.red(SYMBOLS.error)} ${finalText ?? text}`);
    },
  };

  return spinner;
}
