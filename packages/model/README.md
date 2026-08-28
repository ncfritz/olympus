# olympus-model

[![Release](https://github.com/ncfritz/olympus-model/actions/workflows/release.yml/badge.svg)](https://github.com/ncfritz/olympus-model/actions/workflows/release.yml)

This is the API model for Olympus service.  It contains the base interfaces and shapes
for the Olympus REST API.  This package uses `@nestjs/swagger` to annotate all shapes
to produce proper OpenAPI metadata.

This package is intended to be consumed solely by `olumpus-api` or other such API 
services.  The actual SDK shapes are derived from `olympus-api`, which exports it's 
API surface as a series of OpenAPI specifications.  The `olympus-sdk` package consumes 
these definitions to produce the actual SDK impelementation.