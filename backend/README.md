# Rival Store — Backend API

ASP.NET Core **.NET 10** backend for the *Rival* Arabic luxury e-commerce store (guest checkout, WhatsApp-based fulfilment, single-admin OTP login).

**Stack:** .NET 10 · EF Core 10 · Npgsql 10 / PostgreSQL 16 · Redis 7 · MediatR (CQRS) · FluentValidation · Serilog · Swagger · Docker.

```
Store.sln
├─ src/Store.Domain           entities, enums, domain rules (no dependencies)
├─ src/Store.Application      CQRS features, validators, DTOs, interfaces (→ Domain)
├─ src/Store.Infrastructure   EF Core (StoreDbContext, migrations, seed), Redis, storage, e-mail, security (→ Application)
├─ src/Store.Api              controllers, middleware, filters, Program.cs (→ Application + Infrastructure for DI)
├─ tests/Store.UnitTests      xUnit unit tests (domain rules, validators, image/security services)
└─ tests/Store.IntegrationTests  WebApplicationFactory pipeline tests (+ skipped DB tests)
```

Frontend contract: [`docs/api-contract-addendum.md`](docs/api-contract-addendum.md). Deployment: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## 1. Run everything with Docker Compose

```bash
cp .env.example .env          # then edit: POSTGRES_PASSWORD, Jwt__Secret, Security__*, Resend__*
docker compose up -d --build
```

| Service  | URL / port                    |
|----------|-------------------------------|
| API      | http://localhost:5000 (container 8080) |
| Postgres | localhost:5432                |
| Redis    | localhost:6379                |
| Health   | http://localhost:5000/api/v1/health |

Migrations + idempotent seed run automatically at startup when `Database__AutoMigrate=true`.

## 2. Run the API locally (Postgres/Redis in Docker)

```bash
docker compose up -d postgres redis
dotnet run --project src/Store.Api
```

`appsettings.Development.json` already points to `localhost:5432` (`rival` / `rival_dev_password`) and `localhost:6379`,
uses the **Development e-mail sender** (the OTP is printed in the console) and local file storage (`wwwroot/uploads`).

* Swagger UI (Development only): **http://localhost:5000/swagger**
* Health: http://localhost:5000/api/v1/health → `{ success, data: { status, checks: { postgres, redis } } }`

### Secrets for local development (never commit)

```bash
cd src/Store.Api
dotnet user-secrets init          # UserSecretsId is already in the csproj
dotnet user-secrets set "Jwt:Secret" "$(openssl rand -base64 48)"
dotnet user-secrets set "Security:DeviceHmacKey" "$(openssl rand -base64 48)"
dotnet user-secrets set "Security:AesKey" "$(openssl rand -base64 32)"
dotnet user-secrets set "Resend:ApiKey" "re_xxxxxxxx"
dotnet user-secrets set "Resend:From" "Rival <no-reply@yourdomain.com>"
dotnet user-secrets set "Email:Provider" "Resend"
dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5432;Database=rival;Username=rival;Password=..."
```

Production uses environment variables with the same keys (`Jwt__Secret`, `Security__AesKey`, …) — see `.env.example`.

## 3. Database migrations

```bash
dotnet tool install --global dotnet-ef        # once

# list / add / apply
dotnet ef migrations list --project src/Store.Infrastructure --startup-project src/Store.Api
dotnet ef migrations add <Name> --project src/Store.Infrastructure --startup-project src/Store.Api --output-dir Persistence/Migrations
dotnet ef database update --project src/Store.Infrastructure --startup-project src/Store.Api
```

The initial migration enables `pg_trgm`, creates every index (unique, composite, partial, GIN trigram on
`Products(Title, Description)`), check constraints and uses PostgreSQL `xmin` as the optimistic-concurrency token.

## 4. Build & test

```bash
dotnet restore
dotnet build -c Release
dotnet test
```

DB-backed integration tests are skipped by default; run them against docker-compose with `RIVAL_RUN_DB_TESTS=1`.

## 5. Admin login flow

1. `POST /api/v1/admin/auth/request-otp` `{ "email": "rivalshpoe@gmail.com" }` → 6-digit code e-mailed (5 min, 60 s cooldown, 3/hour).
2. `POST /api/v1/admin/auth/verify-otp` `{ "email", "code" }` → `{ accessToken, expiresIn }` (15 min JWT, role `Admin`) + `rival_refresh` HttpOnly/Secure/SameSite=Strict cookie (7 days, rotated on refresh).
3. `POST /api/v1/admin/auth/refresh` (cookie) · `POST /api/v1/admin/auth/logout` · `GET /api/v1/admin/auth/me`.

## 6. Conventions

* Every response is `{ "success": true, "data": … }` or `{ "success": false, "errorCode", "message", "correlationId", "fieldErrors"? }`.
* `X-Correlation-Id` is echoed on every response; send `X-Device-Fingerprint` and `Idempotency-Key` on `POST /api/v1/orders`.
* All timestamps are UTC ISO-8601; money is `decimal(18,2)`; enums are serialised as strings (`Pending`, `Confirmed`, …).
* Rate limits (Redis sliding window): 3 orders/hour per device, 30 searches/min per IP, 3 OTP requests/hour per e-mail.
