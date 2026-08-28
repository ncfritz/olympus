# olympus-model

[![Release](https://github.com/ncfritz/olympus-model/actions/workflows/release.yml/badge.svg)](https://github.com/ncfritz/olympus-model/actions/workflows/release.yml)

This is the API model for Olympus service.  It contains the base interfaces and shapes
for the Olympus REST API.  This package uses `@nestjs/swagger` to annotate all shapes
to produce proper OpenAPI metadata.

This package is intended to be consumed solely by `olumpus-api` or other such API 
services.  The actual SDK shapes are derived from `olympus-api`, which exports it's 
API surface as a series of OpenAPI specifications.  The `olympus-sdk` package consumes 
these definitions to produce the actual SDK impelementation.

Changes built into this package will trigger a `repository_dispatch` event with:

1. `event_type` = `olympus-model-released`
2. `client_payload[version` = version of release

Any package that needs to consume the model can trigger a compatibility release build
by updating the GitHub workflow to trigger on the `olympus-model-released` event.

```
on:
  push:
    ...
  repository_dispatch:
    types:
      - olympus-model-released
```

And adding the following steps before `npm clean-install` is run:

```
- name: Create .npmrc
  run: |
    echo "//npm.pkg.github.com/:_authToken=${{ secrets.GITHUB_TOKEN }}" >> .npmrc
    echo "@ncfritz:registry=https://npm.pkg.github.com" >> .npmrc
- name: Update olympus-model
  if: github.event_name == 'repository_dispatch'
  run: |
    npm install @ncfritz/olympus-model@${{ github.event.client_payload.version }}
- name: Commit dependency update
  if: github.event_name == 'repository_dispatch'
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

    git add package.json package-lock.json

    if ! git diff --cached --quiet; then
      git commit -m "Chore (deps): update @ncfritz/olympus-model [skip ci]"
      git push
    fi
```

Note that the `Create .npmrc` step is necessary to authenticate with GitHub Packages and may
already exist in other workflows if they depend on other GitHub hosted packages.