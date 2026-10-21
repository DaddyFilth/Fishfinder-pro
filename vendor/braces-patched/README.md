# braces (vendored, security-patched)

Vendored copy of [`micromatch/braces@3.0.3`](https://github.com/micromatch/braces) (MIT).

## Why this exists

[CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
(uncontrolled recursion in the AST walkers → stack-exhaustion DoS via deeply
nested brace patterns) affects every published release of `braces`. The
maintainer has declined to publish a fix
([micromatch/braces#70](https://github.com/micromatch/braces/issues/70)), and
`npm audit` flags the advisory for as long as `braces <= 3.0.3` is in the tree.

To keep `npm audit` clean without dropping the packages that depend on
`braces` (`micromatch`, `fast-glob`, `@next/eslint-plugin-next`, `ts-morph`,
`shadcn`), this repo resolves `braces` to this directory via a root
`devDependencies` entry (`"braces": "file:vendor/braces-patched"`) and versions
it as `3.0.4`. npm then hoists this copy to the root `node_modules/braces` and
dedupes every transitive `braces` range (`^3.0.2`/`^3.0.3`) onto it.

> Note: a root `overrides` entry with a `file:` spec does **not** work —
> npm 11 fails the install with `Invalid comparator: file:vendor/braces-patched`.
> Do not "fix" this back to `overrides`, and do not move `braces` into
> `optionalDependencies` (a failed optional install would silently fall back
> to the vulnerable registry copy).

## The patch (single change)

`lib/parse.js` — limit brace nesting depth (`MAX_BRACE_DEPTH = 100`), throwing
the same kind of `SyntaxError` as the existing character cap. Parsing is the
front door for every `braces` entrypoint (`compile`, `expand`, `stringify`),
so this bounds all downstream recursive walkers. Real glob patterns never
approach this depth; the upstream detector cites overflow starting around
depth ~3500 for `compile` and ~4000 for `expand`.

## Maintenance

When upstream publishes a fixed release, delete this directory, drop the
`braces` entry from root `devDependencies`, and let npm resolve the registry
version again.
