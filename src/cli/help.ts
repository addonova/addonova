export const HELP_TEXT = `Addonova

Usage:
  addonova <command> [options]
  addonova init [directory] [options]

Commands:
  init        Scaffold a new extension from a template
  build       Build the extension
  dev         Watch sources and rebuild
  clean       Remove generated output
  info        Show environment and configuration details
  doctor      Diagnose the local build environment
  validate    Validate configuration, manifests, and locales
  pack        Package a built extension
  zip         Package a built extension as a zip archive
  analyze     Report bundle inputs, outputs, and dependencies

Options:
  --browser <target>         Browser target: chrome, chromium, edge, or firefox
  --manifest-version <2|3>   Manifest version override
  --mode <mode>              development or production
  --config <path>            Explicit configuration file
  --outdir <path>            Output directory override
  --minify                   Enable minification
  --no-minify                Disable minification
  --sourcemap[=mode]         Enable source maps or select a mode
  --no-sourcemap             Disable source maps
  --browser-api <mode>       Browser API integration: external or bundle
  --include <glob>           Include matching files when packing (repeatable)
  --exclude <glob>           Exclude matching files when packing (repeatable)
  --sources                  Also pack a source archive for Firefox
  --json                     Print the report as JSON (analyze, doctor)
  --verbose                  Show additional error details
  --debug                    Emit structured dev diagnostics to stderr
  --no-color                 Disable colored output
  -h, --help                 Show this help
  -V, --version              Show the Addonova version

Init options:
  -t, --template <name>      Template: vanilla-ts, vanilla-js, react, or gh:owner/repo
  --pm <manager>             Package manager: npm, pnpm, yarn, or bun
  --git, --no-git            Initialize a git repository (default: on)
  --force                    Scaffold into a non-empty directory
  --offline                  Use bundled templates only
`;

export function renderHelp(): string {
  return HELP_TEXT;
}
