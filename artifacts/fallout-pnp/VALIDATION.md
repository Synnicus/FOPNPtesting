# Fallout PnP validation

Run the complete app validation from the workspace root:

```sh
pnpm --filter @workspace/fallout-pnp run validate
```

This runs the TypeScript check, rules tests, Expo's SDK dependency check
(`CI=1 pnpm exec expo install --check`), and Expo Doctor. To run only the Expo
compatibility checks:

```sh
pnpm --filter @workspace/fallout-pnp run check:expo-compat
```

The compatibility checks are read-only: they report SDK version drift and do
not install, upgrade, or rewrite dependencies. Use a network connection that
can reach the npm package registry and Expo's metadata services. If the output
reports a timeout, DNS, proxy, or registry/service connection error, restore
network access and rerun the check; that is not evidence of an incompatible
package. A report naming a package with an unsupported version is an actual
compatibility finding. Review and update only the affected Expo SDK package
versions intentionally, then rerun validation.

GitHub Actions runs this same `validate` script for pull requests and pushes
that change the app or its shared workspace dependencies. Its failure summary
labels Expo network/service access errors separately from SDK compatibility
findings. Dependency installation uses the frozen lockfile, and the validation
job does not change package versions.
