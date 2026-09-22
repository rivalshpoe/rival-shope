using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Store.Application.Common.Interfaces;

namespace Store.Infrastructure.Caching;

/// <summary>
/// Tracks whether Redis is usable and logs the "falling back to memory" warning exactly once per outage
/// (and an information line once the connection is restored). Shared by the three Redis adapters.
/// </summary>
public sealed class RedisAvailability
{
    private readonly ILogger<RedisAvailability> _logger;
    private int _degraded; // 0 = Redis in use, 1 = memory fallback active

    public RedisAvailability(ILogger<RedisAvailability> logger) => _logger = logger;

    public bool IsDegraded => Volatile.Read(ref _degraded) == 1;

    public void MarkUnavailable(string reason, Exception? ex = null)
    {
        if (Interlocked.Exchange(ref _degraded, 1) == 0)
            _logger.LogWarning(ex, "Redis unavailable ({Reason}) — rate limiting, idempotency and caching now run on the in-memory fallback", reason);
    }

    public void MarkAvailable()
    {
        if (Interlocked.Exchange(ref _degraded, 0) == 1)
            _logger.LogInformation("Redis connection restored — switching back from the in-memory fallback");
    }
}

/// <summary>
/// Logs the effective backing store once at startup: no Redis configured, Redis reachable, or Redis configured but
/// unreachable (in-memory fallback until the connection is restored).
/// </summary>
public sealed class RedisStartupProbe : Microsoft.Extensions.Hosting.IHostedService
{
    private readonly StackExchange.Redis.IConnectionMultiplexer? _mux;
    private readonly ILogger<RedisStartupProbe> _logger;

    public RedisStartupProbe(StackExchange.Redis.IConnectionMultiplexer? mux, ILogger<RedisStartupProbe> logger)
    {
        _mux = mux; _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (_mux is null)
            _logger.LogWarning("Redis:ConnectionString is empty — rate limiting, idempotency and caching use the in-memory fallback (single-instance semantics)");
        else if (_mux.IsConnected)
            _logger.LogInformation("Redis connected ({Endpoints})", string.Join(", ", _mux.GetEndPoints().Select(e => e.ToString())));
        else
            _logger.LogWarning("Redis is configured but unreachable at startup — using the in-memory fallback until the connection is restored");
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

/// <summary>
/// Cache-Aside on <see cref="IMemoryCache"/> for single-instance deployments or when Redis is down.
/// Keys are tracked so prefix invalidation works exactly like the Redis SCAN-based implementation.
/// </summary>
public sealed class MemoryCacheService : ICacheService
{
    private readonly IMemoryCache _cache;
    private readonly ConcurrentDictionary<string, byte> _keys = new(StringComparer.Ordinal);

    public MemoryCacheService(IMemoryCache cache) => _cache = cache;

    public Task<T?> GetAsync<T>(string key, CancellationToken ct = default) =>
        Task.FromResult(_cache.TryGetValue(key, out var value) && value is T typed ? typed : default);

    public Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default)
    {
        if (value is null) return Task.CompletedTask;
        using var entry = _cache.CreateEntry(key);
        entry.Value = value;
        entry.AbsoluteExpirationRelativeToNow = ttl;
        entry.Size = 1;
        entry.RegisterPostEvictionCallback((k, _, _, _) => _keys.TryRemove((string)k, out _));
        _keys[key] = 0;
        return Task.CompletedTask;
    }

    public async Task<T> GetOrSetAsync<T>(string key, TimeSpan ttl, Func<CancellationToken, Task<T>> factory, CancellationToken ct = default)
    {
        var cached = await GetAsync<T>(key, ct);
        if (cached is not null) return cached;
        var value = await factory(ct);
        if (value is not null) await SetAsync(key, value, ttl, ct);
        return value;
    }

    public Task RemoveAsync(string key, CancellationToken ct = default)
    {
        _cache.Remove(key);
        _keys.TryRemove(key, out _);
        return Task.CompletedTask;
    }

    public Task RemoveByPrefixAsync(string prefix, CancellationToken ct = default)
    {
        foreach (var key in _keys.Keys)
        {
            if (key.StartsWith(prefix, StringComparison.Ordinal))
            {
                _cache.Remove(key);
                _keys.TryRemove(key, out _);
            }
        }
        return Task.CompletedTask;
    }
}

/// <summary>
/// Process-local sliding-window limiter (timestamps per key). Same semantics as the Redis Lua script:
/// a hit is counted only when allowed; Retry-After is derived from the oldest timestamp in the window.
/// </summary>
public sealed class MemoryRateLimiter : IRateLimiter
{
    private readonly ConcurrentDictionary<string, Bucket> _buckets = new(StringComparer.Ordinal);
    private readonly TimeProvider _time;
    private long _lastSweepTicks;

    public MemoryRateLimiter(TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;
        _lastSweepTicks = _time.GetUtcNow().UtcTicks;
    }

    public Task<RateLimitResult> HitAsync(string key, int limit, TimeSpan window, CancellationToken ct = default)
    {
        var now = _time.GetUtcNow().UtcTicks;
        var windowTicks = window.Ticks;
        SweepIfDue(now);

        var bucket = _buckets.GetOrAdd(key, static _ => new Bucket());
        lock (bucket)
        {
            var cutoff = now - windowTicks;
            while (bucket.Hits.Count > 0 && bucket.Hits.Peek() <= cutoff)
                bucket.Hits.Dequeue();

            if (bucket.Hits.Count < limit)
            {
                bucket.Hits.Enqueue(now);
                bucket.LastTouched = now;
                return Task.FromResult(new RateLimitResult(true, bucket.Hits.Count, limit, 0));
            }

            var retryTicks = bucket.Hits.Peek() + windowTicks - now;
            var retrySeconds = (int)Math.Max(1, Math.Ceiling(retryTicks / (double)TimeSpan.TicksPerSecond));
            bucket.LastTouched = now;
            return Task.FromResult(new RateLimitResult(false, bucket.Hits.Count, limit, retrySeconds));
        }
    }

    /// <summary>Removes buckets untouched for over an hour so the dictionary cannot grow without bound.</summary>
    private void SweepIfDue(long now)
    {
        var last = Volatile.Read(ref _lastSweepTicks);
        if (now - last < TimeSpan.TicksPerMinute * 5) return;
        if (Interlocked.CompareExchange(ref _lastSweepTicks, now, last) != last) return;

        var staleBefore = now - TimeSpan.TicksPerHour;
        foreach (var (key, bucket) in _buckets)
        {
            bool stale;
            lock (bucket) stale = bucket.LastTouched < staleBefore;
            if (stale) _buckets.TryRemove(key, out _);
        }
    }

    private sealed class Bucket
    {
        public readonly Queue<long> Hits = new();
        public long LastTouched;
    }
}

/// <summary>
/// Process-local Idempotency-Key store with the same state machine as <see cref="RedisIdempotencyStore"/>
/// (Acquired → InFlight for others → Completed with the cached response, or Released).
/// </summary>
public sealed class MemoryIdempotencyStore : IIdempotencyStore
{
    private readonly ConcurrentDictionary<string, Entry> _entries = new(StringComparer.Ordinal);
    private readonly TimeProvider _time;
    private long _lastSweepTicks;

    public MemoryIdempotencyStore(TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;
        _lastSweepTicks = _time.GetUtcNow().UtcTicks;
    }

    public Task<IdempotencyBeginResult> BeginAsync(string key, TimeSpan inFlightTtl, CancellationToken ct = default)
    {
        var now = _time.GetUtcNow().UtcTicks;
        SweepIfDue(now);

        while (true)
        {
            var fresh = new Entry(null, now + inFlightTtl.Ticks);
            if (_entries.TryAdd(key, fresh))
                return Task.FromResult(new IdempotencyBeginResult(IdempotencyState.Acquired, null));

            if (!_entries.TryGetValue(key, out var existing))
                continue; // removed between TryAdd and TryGetValue — retry

            if (existing.ExpiresAtTicks <= now)
            {
                // Expired marker/response: take over the slot atomically.
                if (_entries.TryUpdate(key, fresh, existing))
                    return Task.FromResult(new IdempotencyBeginResult(IdempotencyState.Acquired, null));
                continue;
            }

            return Task.FromResult(existing.Response is null
                ? new IdempotencyBeginResult(IdempotencyState.InFlight, null)
                : new IdempotencyBeginResult(IdempotencyState.Completed, existing.Response));
        }
    }

    public Task CompleteAsync(string key, IdempotentResponse response, TimeSpan ttl, CancellationToken ct = default)
    {
        _entries[key] = new Entry(response, _time.GetUtcNow().UtcTicks + ttl.Ticks);
        return Task.CompletedTask;
    }

    public Task ReleaseAsync(string key, CancellationToken ct = default)
    {
        _entries.TryRemove(key, out _);
        return Task.CompletedTask;
    }

    private void SweepIfDue(long now)
    {
        var last = Volatile.Read(ref _lastSweepTicks);
        if (now - last < TimeSpan.TicksPerMinute * 5) return;
        if (Interlocked.CompareExchange(ref _lastSweepTicks, now, last) != last) return;

        foreach (var (key, entry) in _entries)
            if (entry.ExpiresAtTicks <= now) _entries.TryRemove(key, out _);
    }

    private sealed record Entry(IdempotentResponse? Response, long ExpiresAtTicks);
}
