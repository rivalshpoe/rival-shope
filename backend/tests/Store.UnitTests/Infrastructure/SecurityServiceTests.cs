using Microsoft.Extensions.Options;
using Store.Infrastructure.Options;
using Store.Infrastructure.Security;

namespace Store.UnitTests.Infrastructure;

public class SecurityServiceTests
{
    private static DeviceFingerprintService Service() => new(Options.Create(new SecurityOptions
    {
        DeviceHmacKey = "unit-test-hmac-key-0123456789abcdef0123456789",
        AesKey = Convert.ToBase64String(new byte[32])
    }));

    [Fact]
    public void Fingerprint_hash_is_deterministic_and_hex_sha256_length()
    {
        var svc = Service();
        var a = svc.ComputeHash("device-uuid-1");
        var b = svc.ComputeHash("device-uuid-1");
        var c = svc.ComputeHash("device-uuid-2");
        Assert.Equal(a, b);
        Assert.NotEqual(a, c);
        Assert.Equal(64, a.Length);
    }

    [Fact]
    public void Fingerprint_encryption_uses_random_nonce_and_is_not_plaintext()
    {
        var svc = Service();
        var e1 = svc.Encrypt("device-uuid-1");
        var e2 = svc.Encrypt("device-uuid-1");
        Assert.NotEqual(e1, e2);
        Assert.Equal(12 + 16 + "device-uuid-1".Length, e1.Length);
        Assert.DoesNotContain("device-uuid-1", System.Text.Encoding.UTF8.GetString(e1));
    }

    [Fact]
    public void Mask_hides_the_middle_of_the_hash()
    {
        var masked = Service().Mask("abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789");
        Assert.Equal("abcdef…6789", masked);
    }

    [Fact]
    public void Otp_hasher_verifies_correct_code_and_rejects_wrong_or_garbage_hash()
    {
        var hasher = new BcryptOtpHasher();
        var hash = hasher.Hash("123456");
        Assert.True(hasher.Verify("123456", hash));
        Assert.False(hasher.Verify("654321", hash));
        Assert.False(hasher.Verify("123456", "not-a-bcrypt-hash"));
    }

    [Fact]
    public void Jwt_generator_issues_15_minute_admin_token_and_hashed_refresh_tokens()
    {
        var clock = new FixedClock(new DateTime(2026, 9, 22, 12, 0, 0, DateTimeKind.Utc));
        var jwt = new JwtTokenGenerator(Options.Create(new JwtOptions
        {
            Secret = "unit-test-secret-0123456789abcdef0123456789abcdef", Issuer = "rival-api", Audience = "rival-admin"
        }), clock);

        var access = jwt.GenerateAccessToken(Guid.NewGuid(), "admin@example.com");
        Assert.Equal(15 * 60, access.ExpiresInSeconds);

        var token = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().ReadJwtToken(access.Token);
        Assert.Equal("rival-api", token.Issuer);
        Assert.Contains(token.Claims, c => c.Type == System.Security.Claims.ClaimTypes.Role && c.Value == "Admin");
        Assert.Equal(clock.UtcNow.AddMinutes(15), token.ValidTo);

        var (raw, hash) = jwt.GenerateRefreshToken();
        Assert.NotEqual(raw, hash);
        Assert.Equal(64, hash.Length);
        Assert.Equal(hash, jwt.HashRefreshToken(raw));
        Assert.Equal(7, jwt.RefreshTokenDays);
    }

    [Fact]
    public void Jwt_generator_refuses_short_secret()
    {
        Assert.Throws<InvalidOperationException>(() =>
            new JwtTokenGenerator(Options.Create(new JwtOptions { Secret = "short" }), new FixedClock(DateTime.UtcNow)));
    }

    private sealed class FixedClock(DateTime now) : Store.Application.Common.Interfaces.IDateTimeProvider
    {
        public DateTime UtcNow => now;
    }
}
