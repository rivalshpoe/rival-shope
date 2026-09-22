using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Time.Testing;
using Store.Application.Common.Interfaces;
using Store.Infrastructure.Caching;

namespace Store.UnitTests.Infrastructure;

public class MemoryRateLimiterTests
{
    private static readonly TimeSpan Hour = TimeSpan.FromHours(1);

    [Fact]
    public async Task Allows_up_to_the_limit_then_blocks_with_retry_after()
    {
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 9, 22, 12, 0, 0, TimeSpan.Zero));
        var limiter = new MemoryRateLimiter(clock);

        var r1 = await limiter.HitAsync("orders:fp:a", 3, Hour);
        var r2 = await limiter.HitAsync("orders:fp:a", 3, Hour);
        var r3 = await limiter.HitAsync("orders:fp:a", 3, Hour);
        var r4 = await limiter.HitAsync("orders:fp:a", 3, Hour);

        Assert.True(r1.Allowed); Assert.Equal(1, r1.Count);
        Assert.True(r2.Allowed); Assert.Equal(2, r2.Count);
        Assert.True(r3.Allowed); Assert.Equal(3, r3.Count);
        Assert.False(r4.Allowed);
        Assert.Equal(3, r4.Count);
        Assert.Equal(3, r4.Limit);
        Assert.Equal(3600, r4.RetryAfterSeconds);
    }

    [Fact]
    public async Task Blocked_hits_are_not_counted()
    {
        var clock = new FakeTimeProvider();
        var limiter = new MemoryRateLimiter(clock);
        for (var i = 0; i < 5; i++) await limiter.HitAsync("k", 2, Hour);

        var result = await limiter.HitAsync("k", 2, Hour);
        Assert.False(result.Allowed);
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task Window_slides_so_old_hits_expire_individually()
    {
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 9, 22, 12, 0, 0, TimeSpan.Zero));
        var limiter = new MemoryRateLimiter(clock);

        await limiter.HitAsync("k", 3, Hour);          // t = 0
        clock.Advance(TimeSpan.FromMinutes(20));
        await limiter.HitAsync("k", 3, Hour);          // t = 20
        clock.Advance(TimeSpan.FromMinutes(20));
        await limiter.HitAsync("k", 3, Hour);          // t = 40

        var blocked = await limiter.HitAsync("k", 3, Hour);
        Assert.False(blocked.Allowed);
        Assert.Equal(20 * 60, blocked.RetryAfterSeconds); // oldest hit (t=0) leaves the window at t=60

        clock.Advance(TimeSpan.FromMinutes(20).Add(TimeSpan.FromSeconds(1))); // t = 60:01 → the first hit expired
        var allowedAgain = await limiter.HitAsync("k", 3, Hour);
        Assert.True(allowedAgain.Allowed);
        Assert.Equal(3, allowedAgain.Count);

        var blockedAgain = await limiter.HitAsync("k", 3, Hour);
        Assert.False(blockedAgain.Allowed); // t=20 hit is still inside the window
    }

    [Fact]
    public async Task Keys_are_isolated_from_each_other()
    {
        var limiter = new MemoryRateLimiter(new FakeTimeProvider());
        for (var i = 0; i < 3; i++) await limiter.HitAsync("a", 3, Hour);

        Assert.False((await limiter.HitAsync("a", 3, Hour)).Allowed);
        Assert.True((await limiter.HitAsync("b", 3, Hour)).Allowed);
    }

    [Fact]
    public async Task Concurrent_hits_never_exceed_the_limit()
    {
        var limiter = new MemoryRateLimiter();
        var results = await Task.WhenAll(Enumerable.Range(0, 200).Select(_ => Task.Run(() => limiter.HitAsync("burst", 30, Hour))));

        Assert.Equal(30, results.Count(r => r.Allowed));
        Assert.Equal(170, results.Count(r => !r.Allowed));
    }
}

public class MemoryIdempotencyStoreTests
{
    private static readonly TimeSpan InFlight = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan Ttl = TimeSpan.FromHours(24);
    private static readonly IdempotentResponse Response = new(201, "application/json", "{\"ok\":true}");

    [Fact]
    public async Task First_begin_acquires_and_second_sees_in_flight()
    {
        var store = new MemoryIdempotencyStore(new FakeTimeProvider());

        var first = await store.BeginAsync("k", InFlight);
        var second = await store.BeginAsync("k", InFlight);

        Assert.Equal(IdempotencyState.Acquired, first.State);
        Assert.Equal(IdempotencyState.InFlight, second.State);
        Assert.Null(second.Cached);
    }

    [Fact]
    public async Task Completed_key_replays_the_stored_response()
    {
        var store = new MemoryIdempotencyStore(new FakeTimeProvider());
        await store.BeginAsync("k", InFlight);
        await store.CompleteAsync("k", Response, Ttl);

        var replay = await store.BeginAsync("k", InFlight);

        Assert.Equal(IdempotencyState.Completed, replay.State);
        Assert.Equal(Response, replay.Cached);
    }

    [Fact]
    public async Task Released_key_can_be_acquired_again()
    {
        var store = new MemoryIdempotencyStore(new FakeTimeProvider());
        await store.BeginAsync("k", InFlight);
        await store.ReleaseAsync("k");

        var again = await store.BeginAsync("k", InFlight);
        Assert.Equal(IdempotencyState.Acquired, again.State);
    }

    [Fact]
    public async Task Stale_in_flight_marker_is_taken_over_after_its_ttl()
    {
        var clock = new FakeTimeProvider();
        var store = new MemoryIdempotencyStore(clock);
        await store.BeginAsync("k", InFlight);

        clock.Advance(InFlight.Add(TimeSpan.FromSeconds(1)));
        var takeover = await store.BeginAsync("k", InFlight);

        Assert.Equal(IdempotencyState.Acquired, takeover.State);
    }

    [Fact]
    public async Task Completed_response_expires_after_its_ttl()
    {
        var clock = new FakeTimeProvider();
        var store = new MemoryIdempotencyStore(clock);
        await store.BeginAsync("k", InFlight);
        await store.CompleteAsync("k", Response, Ttl);

        clock.Advance(Ttl.Add(TimeSpan.FromSeconds(1)));
        var fresh = await store.BeginAsync("k", InFlight);

        Assert.Equal(IdempotencyState.Acquired, fresh.State);
    }

    [Fact]
    public async Task Only_one_of_many_concurrent_begins_acquires()
    {
        var store = new MemoryIdempotencyStore();
        var results = await Task.WhenAll(Enumerable.Range(0, 100).Select(_ => Task.Run(() => store.BeginAsync("race", InFlight))));

        Assert.Equal(1, results.Count(r => r.State == IdempotencyState.Acquired));
        Assert.Equal(99, results.Count(r => r.State == IdempotencyState.InFlight));
    }
}

public class MemoryCacheServiceTests
{
    private static MemoryCacheService Create() => new(new MemoryCache(new MemoryCacheOptions()));

    [Fact]
    public async Task GetOrSet_calls_factory_once_and_serves_from_cache()
    {
        var cache = Create();
        var calls = 0;
        Func<CancellationToken, Task<string>> factory = _ => { calls++; return Task.FromResult("v"); };

        var a = await cache.GetOrSetAsync("categories:all", TimeSpan.FromMinutes(1), factory);
        var b = await cache.GetOrSetAsync("categories:all", TimeSpan.FromMinutes(1), factory);

        Assert.Equal("v", a); Assert.Equal("v", b);
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task RemoveByPrefix_only_evicts_matching_keys()
    {
        var cache = Create();
        await cache.SetAsync("products:list:a", 1, TimeSpan.FromMinutes(1));
        await cache.SetAsync("products:list:b", 2, TimeSpan.FromMinutes(1));
        await cache.SetAsync("products:detail:x", 3, TimeSpan.FromMinutes(1));

        await cache.RemoveByPrefixAsync("products:list:");

        Assert.Null(await cache.GetAsync<int?>("products:list:a"));
        Assert.Null(await cache.GetAsync<int?>("products:list:b"));
        Assert.Equal(3, await cache.GetAsync<int?>("products:detail:x"));
    }
}
