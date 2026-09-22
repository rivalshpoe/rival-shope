# syntax=docker/dockerfile:1.7
# ---------- build ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first (layer cache): copy only project/solution metadata.
COPY Directory.Build.props Store.sln ./
COPY src/Store.Domain/Store.Domain.csproj                 src/Store.Domain/
COPY src/Store.Application/Store.Application.csproj       src/Store.Application/
COPY src/Store.Infrastructure/Store.Infrastructure.csproj src/Store.Infrastructure/
COPY src/Store.Api/Store.Api.csproj                       src/Store.Api/
RUN dotnet restore src/Store.Api/Store.Api.csproj

COPY src/ src/
RUN dotnet publish src/Store.Api/Store.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ---------- runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# curl is only needed for the HEALTHCHECK.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# Non-root user (the aspnet image ships with uid 1654 "app" since .NET 8).
RUN mkdir -p /app/wwwroot/uploads /app/logs && chown -R app:app /app
USER app

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_gcServer=0 \
    DOTNET_TieredPGO=1

COPY --from=build --chown=app:app /app/publish .

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:8080/api/v1/health || exit 1

ENTRYPOINT ["dotnet", "Store.Api.dll"]
