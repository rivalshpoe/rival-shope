using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackExchange.Redis;
using Store.Application.Common.Interfaces;
using Store.Infrastructure.Options;

namespace Store.Infrastructure.Caching;

/// <summary>
/// Idempotency-Key store: SET NX marks a key in-flight; the completed response is stored for 24h and replayed verbatim.
/// Falls over to <see cref="MemoryIdempotencyStore"/> whenever Redis is disconnected or a command fails, so a replayed
/// key is still recognised (per instance) instead of creating a duplicate order.
/// </summary>
public sealed class RedisIdempotencyStore : IIdempotencyStore
{
    private const string InFlightMarker = "__inflight__";
    private readonly IConnectionMultiplexer? _mux;
    private readonly MemoryIdempotencyStore _fallback;
    private readonly RedisAvailability _availability;
    private readonly string _prefix;
    private readonly ILogger<RedisIdempotencyStore> _logger;

    public RedisIdempotencyStore(IConnectionMultiplexer? mux, MemoryIdempotencyStore fallback, RedisAvailability availability,
        IOptions<RedisOptions> options, ILogger<RedisIdempotencyStore> logger)
    {
        _mux = mux;
        _fallback = fallback;
        _availability = availability;
        _prefix = (options.Value.InstanceName ?? string.Empty) + "idem:";
        _logger = logger;
    }

    public async Task<IdempotencyBeginResult> BeginAsync(string key, TimeSpan inFlightTtl, CancellationToken ct = default)
    {
        if (_mux is not { IsConnected: true })
        {
            _availability.MarkUnavailable("not connected");
            return await _fallback.BeginAsync(key, inFlightTtl, ct);
        }

        try
        {
            var db = _mux.GetDatabase();
            var redisKey = _prefix + key;
            if (await db.StringSetAsync(redisKey, InFlightMarker, inFlightTtl, When.NotExists))
            {
                _availability.MarkAvailable();
                return new IdempotencyBeginResult(IdempotencyState.Acquired, null);
            }

            var existing = await db.StringGetAsync(redisKey);
            _availability.MarkAvailable();
            if (existing.IsNullOrEmpty) return new IdempotencyBeginResult(IdempotencyState.Acquired, null);
            if ((string)existing! == InFlightMarker) return new IdempotencyBeginResult(IdempotencyState.InFlight, null);

            var cached = JsonSerializer.Deserialize<IdempotentResponse>((string)existing!);
            return cached is null
                ? new IdempotencyBeginResult(IdempotencyState.Acquired, null)
                : new IdempotencyBeginResult(IdempotencyState.Completed, cached);
        }
        catch (Exception ex) when (ex is RedisException or TimeoutException or JsonException or ObjectDisposedException)
        {
            _availability.MarkUnavailable("command failed", ex);
            _logger.LogDebug(ex, "Idempotency store falling back to memory");
            return await _fallback.BeginAsync(key, inFlightTtl, ct);
        }
    }

    public async Task CompleteAsync(string key, IdempotentResponse response, TimeSpan ttl, CancellationToken ct = default)
    {
        // Always record in memory too: if Redis dies between Begin and Complete the replay still works on this instance.
        await _fallback.CompleteAsync(key, response, ttl, ct);
        if (_mux is not { IsConnected: true }) return;
        try { await _mux.GetDatabase().StringSetAsync(_prefix + key, JsonSerializer.Serialize(response), ttl); }
        catch (Exception ex) when (ex is RedisException or TimeoutException or ObjectDisposedException)
        {
            _availability.MarkUnavailable("command failed", ex);
        }
    }

    public async Task ReleaseAsync(string key, CancellationToken ct = default)
    {
        await _fallback.ReleaseAsync(key, ct);
        if (_mux is not { IsConnected: true }) return;
        try { await _mux.GetDatabase().KeyDeleteAsync(_prefix + key); }
        catch (Exception ex) when (ex is RedisException or TimeoutException or ObjectDisposedException)
        {
            _availability.MarkUnavailable("command failed", ex);
        }
    }
}

/// <summary>Disables replay protection entirely — only for isolated unit tests.</summary>
public sealed class NoOpIdempotencyStore : IIdempotencyStore
{
    public Task<IdempotencyBeginResult> BeginAsync(string key, TimeSpan inFlightTtl, CancellationToken ct = default) =>
        Task.FromResult(new IdempotencyBeginResult(IdempotencyState.Unavailable, null));
    public Task CompleteAsync(string key, IdempotentResponse response, TimeSpan ttl, CancellationToken ct = default) => Task.CompletedTask;
    public Task ReleaseAsync(string key, CancellationToken ct = default) => Task.CompletedTask;
}
