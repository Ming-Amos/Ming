# Local install compatibility note

The actual install output reports pnpm 11.2.2. The failed install reports that esbuild@0.21.3 requires build approval.

Use the installed pnpm version's project-local configuration, without reading credentials or changing global tools. The official pnpm 11 release notes replace the old `onlyBuiltDependencies` key with `allowBuilds` in `pnpm-workspace.yaml`.

Source checked 2026-09-26: https://github.com/pnpm/pnpm.io/blob/main/blog/releases/11.0.md

Replace the obsolete setting with a narrowly scoped esbuild approval, such as `allowBuilds: { esbuild: true }`, then rerun installation and verify the build. Keep other dependency build restrictions in force. There is no need to inspect `.npmrc` credentials or disable security controls globally.

This note is Codex research assistance; Bob remains responsible for applying and validating the project configuration.
