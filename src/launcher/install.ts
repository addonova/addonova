import type { BidiClient } from './bidi.ts';
import { connectBidi } from './bidi.ts';
import type { CdpClient } from './cdp.ts';
import { connectCdpPipe } from './cdp.ts';
import type { ManagedProcess } from './process.ts';

export interface InstallExtensionOptions {
  timeoutMs?: number;
  onSessionEstablished?: () => void;
}

export interface ChromiumInstallResult {
  cdp: CdpClient;
  extensionId: string;
}

export interface FirefoxInstallResult {
  bidi: BidiClient;
  extensionId: string;
}

export async function installChromium(
  browserProcess: ManagedProcess,
  extensionDir: string,
  options: InstallExtensionOptions = {},
): Promise<ChromiumInstallResult> {
  const cdp = connectCdpPipe(
    browserProcess.child,
    options.timeoutMs ?? 10_000,
  );

  try {
    const extensionId = await cdp.loadUnpacked(extensionDir);

    return { cdp, extensionId };
  } catch (error) {
    cdp.dispose();
    throw error;
  }
}

export async function installFirefox(
  debuggerUrl: string,
  extensionDir: string,
  options: InstallExtensionOptions = {},
): Promise<FirefoxInstallResult> {
  const bidi = await connectBidi(debuggerUrl, {
    timeoutMs: options.timeoutMs ?? 10_000,
  });

  try {
    await bidi.newSession();
    options.onSessionEstablished?.();
    const extensionId = await bidi.installWebExtension(extensionDir);

    return { bidi, extensionId };
  } catch (error) {
    bidi.dispose();
    throw error;
  }
}
