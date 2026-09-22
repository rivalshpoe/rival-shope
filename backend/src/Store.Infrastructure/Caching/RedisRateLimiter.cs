using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackExchange.Redis;
using Store.Application.Common.Interfaces;
using Store.Infrastructure.Options;

namespace Store.Infrastructure.Caching;

/// <summary>
/// Sliding-window limiter on a Redis sorted set (one atomic Lua script per hit). When Redis is disconnected or a call
/// fails, the hit is counted by the process-local <see cref="MemoryRateLimiter"/> instead, so limits stay enforced
/// (per instance) rather than silently disappearing (fail-over, not fail-open).
/// </summary>
public sealed class RedisRateLimiter : IRateLimiter
{
    // KEYS[1] = key, ARGV[1] = now(ms), ARGV[2] = window(ms), ARGV[3] = limit, ARGV[4] = member
    private const string Script = """
        redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, tonumber(ARGV[1]) - tonumber(ARGV[2]))
        local count = redis.call('ZCARD', KEYS[1])
        if count < tonumber(ARGV[3]) then
          redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
          redis.call('PEXPIRE', KEYS[1], ARGV[2])
          return {1, count + 1, 0}
        end
        local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
        local retry = 0
        if oldest[2] then retry = tonumber(oldest[2]) + tonumber(ARGV[2]) - tonumber(ARGV[1]) end
        return {0, count, retry}
        """;

    private readonly IConnectionMultiplexer? _mux;
    private readonly MemoryRateLimiter _fallback;
    private readonly RedisAvailability _availability;
    private readonly string _prefix;
    private readonly ILogger<RedisRateLimiter> _logger;

    public RedisRateLimiter(IConnectionMultiplexer? mux, MemoryRateLimiter fallback, RedisAvailability availability,
        IOptions<RedisOptions> options, ILogger<RedisRateLimiter> logger)
    {
        _mux = mux;
        _fallback = fallback;
        _availability = availability;
        _prefix = (options.Value.InstanceName ?? string.Empty) + "rl:";
        _logger = logger;
    }

    public async Task<RateLimitResult> HitAsync(string key, int limit, TimeSpan window, CancellationToken ct = default)
    {
        if (_mux is not { IsConnected: true })
        {
            _availability.MarkUnavailable("not connected");
            return await _fallback.HitAsync(key, limit, window, ct);
        }

        try
        {
            var db = _mux.GetDatabase();
            var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var result = (RedisResult[]?)await db.ScriptEvaluateAsync(Script,
                [new RedisKey(_prefix + key)],
                [nowMs, (long)window.TotalMilliseconds, limit, $"{nowMs}-{Guid.NewGuid():N}"]);

            _availability.MarkAvailable();
            if (result is null || result.Length < 3)
                return await _fallback.HitAsync(key, limit, window, ct);

            var allowed = (long)result[0] == 1;
            var count = (int)(long)result[1];
            var retryMs = (long)result[2];
            return new RateLimitResult(allowed, count, limit, (int)Math.Ceiling(Math.Max(retryMs, 0) / 1000d));
        }
        catch (Exception ex) when (ex is RedisException or TimeoutException or ObjectDisposedException)
        {
            _availability.MarkUnavailable("command failed", ex);
            _logger.LogDebug(ex, "Rate limiter falling back to memory for {Rule}", key.Split(':')[0]);
            return await _fallback.HitAsync(key, limit, window, ct);
        }
    }
}

/// <summary>Never limits — only for unit tests that exercise handlers in isolation.</summary>
public sealed class NoOpRateLimiter : IRateLimiter
{
    public Task<RateLimitResult> HitAsync(string key, int limit, TimeSpan window, CancellationToken ct = default) =>
        Task.FromResult(new RateLimitResult(true, 0, limit, 0));
}
