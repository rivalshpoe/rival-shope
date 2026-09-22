using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackExchange.Redis;
using Store.Application.Common.Interfaces;
using Store.Infrastructure.Options;

namespace Store.Infrastructure.Caching;

/// <summary>
/// Cache-Aside over Redis. Every Redis call is guarded: when Redis is down the call is served by the process-local
/// <see cref="MemoryCacheService"/> (short TTLs, invalidated by the same handlers), so the API keeps serving from
/// PostgreSQL + memory instead of failing (spec §13).
/// </summary>
public sealed class RedisCacheService : ICacheService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly IConnectionMultiplexer? _mux;
    private readonly MemoryCacheService _fallback;
    private readonly RedisAvailability _availability;
    private readonly string _prefix;
    private readonly ILogger<RedisCacheService> _logger;

    public RedisCacheService(IConnectionMultiplexer? mux, MemoryCacheService fallback, RedisAvailability availability,
        IOptions<RedisOptions> options, ILogger<RedisCacheService> logger)
    {
        _mux = mux;
        _fallback = fallback;
        _availability = availability;
        _prefix = options.Value.InstanceName ?? string.Empty;
        _logger = logger;
    }

    private IDatabase? Db
    {
        get
        {
            if (_mux is { IsConnected: true }) return _mux.GetDatabase();
            _availability.MarkUnavailable("not connected");
            return null;
        }
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default)
    {
        var db = Db;
        if (db is null) return await _fallback.GetAsync<T>(key, ct);
        try
        {
            var value = await db.StringGetAsync(_prefix + key);
            _availability.MarkAvailable();
            if (value.IsNullOrEmpty) return default;
            return JsonSerializer.Deserialize<T>((string)value!, Json);
        }
        catch (Exception ex) when (ex is RedisException or TimeoutException or JsonException or ObjectDisposedException)
        {
            _availability.MarkUnavailable("command failed", ex);
            _logger.LogDebug(ex, "Cache GET failed for {Key}; using memory fallback", key);
            return await _fallback.GetAsync<T>(key, ct);
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default)
    {
        if (value is null) return;
        var db = Db;
        if (db is null) { await _fallback.SetAsync(key, value, ttl, ct); return; }
        try
        {
            await db.StringSetAsync(_prefix + key, JsonSerializer.Serialize(value, Json), ttl);
            _availability.MarkAvailable();
        }
        catch (Exception ex) when (ex is RedisException or TimeoutException or ObjectDisposedException)
        {
            _availability.MarkUnavailable("command failed", ex);
            await _fallback.SetAsync(key, value, ttl, ct);
        }
    }

    public async Task<T> GetOrSetAsync<T>(string key, TimeSpan ttl, Func<CancellationToken, Task<T>> factory, CancellationToken ct = default)
    {
        var cached = await GetAsync<T>(key, ct);
        if (cached is not null) return cached;
        var value = await factory(ct);
        if (value is not null) await SetAsync(key, value, ttl, ct);
        return value;
    }

    public async Task RemoveAsync(string key, CancellationToken ct = default)
    {
        // Invalidate both layers: an entry may have been written to memory during an outage.
        await _fallback.RemoveAsync(key, ct);
        var db = Db;
        if (db is null) return;
        try { await db.KeyDeleteAsync(_prefix + key); }
        catch (Exception ex) when (ex is RedisException or TimeoutException or ObjectDisposedException)
        {
            _availability.MarkUnavailable("command failed", ex);
            _logger.LogWarning(ex, "Cache DEL failed for {Key} (entry expires by TTL)", key);
        }
    }

    public async Task RemoveByPrefixAsync(string prefix, CancellationToken ct = default)
    {
        await _fallback.RemoveByPrefixAsync(prefix, ct);
        if (_mux is not { IsConnected: true }) return;
        try
        {
            var db = _mux.GetDatabase();
            var pattern = _prefix + prefix + "*";
            foreach (var endpoint in _mux.GetEndPoints())
            {
                var server = _mux.GetServer(endpoint);
                if (!server.IsConnected || server.IsReplica) continue;
                var batch = new List<RedisKey>(256);
                await foreach (var key in server.KeysAsync(pattern: pattern, pageSize: 500).WithCancellation(ct))
                {
                    batch.Add(key);
                    if (batch.Count >= 256)
                    {
                        await db.KeyDeleteAsync(batch.ToArray());
                        batch.Clear();
                    }
                }
                if (batch.Count > 0) await db.KeyDeleteAsync(batch.ToArray());
            }
        }
        catch (Exception ex) when (ex is RedisException or TimeoutException or ObjectDisposedException)
        {
            _availability.MarkUnavailable("command failed", ex);
            _logger.LogWarning(ex, "Cache prefix invalidation failed for {Prefix} (entries expire by TTL)", prefix);
        }
    }
}

/// <summary>Disables caching entirely — only for isolated unit tests.</summary>
public sealed class NoOpCacheService : ICacheService
{
    public Task<T?> GetAsync<T>(string key, CancellationToken ct = default) => Task.FromResult<T?>(default);
    public Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default) => Task.CompletedTask;
    public Task<T> GetOrSetAsync<T>(string key, TimeSpan ttl, Func<CancellationToken, Task<T>> factory, CancellationToken ct = default) => factory(ct);
    public Task RemoveAsync(string key, CancellationToken ct = default) => Task.CompletedTask;
    public Task RemoveByPrefixAsync(string prefix, CancellationToken ct = default) => Task.CompletedTask;
}
