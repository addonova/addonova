export function renderHelp(): string {
  return `Addonova

Usage:
  addonova <command> [options]

Commands:
  build       Build the extension
  dev         Watch sources and rebuild
  clean       Remove generated output
  info        Show environment and configuration details
  validate    Validate configuration and manifest structure
  pack        Package a built extension

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
  --verbose                  Show additional error details
  -h, --help                 Show this help
  -V, --version              Show the Addonova version
`;
}
