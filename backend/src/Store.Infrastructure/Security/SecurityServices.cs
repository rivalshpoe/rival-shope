using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Store.Application.Common.Interfaces;
using Store.Infrastructure.Options;

namespace Store.Infrastructure.Security;

public sealed class JwtTokenGenerator : IJwtTokenGenerator
{
    public const string AdminRole = "Admin";
    private readonly JwtOptions _options;
    private readonly IDateTimeProvider _clock;

    public JwtTokenGenerator(IOptions<JwtOptions> options, IDateTimeProvider clock)
    {
        _options = options.Value;
        _clock = clock;
        if (string.IsNullOrWhiteSpace(_options.Secret) || _options.Secret.Length < 32)
            throw new InvalidOperationException("Jwt:Secret must be configured with at least 32 characters (use `dotnet user-secrets` or environment variables).");
    }

    public int RefreshTokenDays => _options.RefreshTokenDays;

    public AccessTokenResult GenerateAccessToken(Guid adminId, string email)
    {
        var now = _clock.UtcNow;
        var expires = now.AddMinutes(_options.AccessTokenMinutes);
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, adminId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new Claim(ClaimTypes.Role, AdminRole)
        };

        var token = new JwtSecurityToken(_options.Issuer, _options.Audience, claims, notBefore: now, expires: expires, signingCredentials: creds);
        return new AccessTokenResult(new JwtSecurityTokenHandler().WriteToken(token), (int)(expires - now).TotalSeconds);
    }

    public (string RawToken, string TokenHash) GenerateRefreshToken()
    {
        var raw = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(64));
        return (raw, HashRefreshToken(raw));
    }

    public string HashRefreshToken(string rawToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))).ToLowerInvariant();
}

/// <summary>HMAC-SHA256 lookup hash + AES-256-GCM at-rest encryption of the raw fingerprint (spec §7).</summary>
public sealed class DeviceFingerprintService : IDeviceFingerprintService
{
    private readonly byte[] _hmacKey;
    private readonly byte[] _aesKey;

    public DeviceFingerprintService(IOptions<SecurityOptions> options)
    {
        var o = options.Value;
        if (string.IsNullOrWhiteSpace(o.DeviceHmacKey) || o.DeviceHmacKey.Length < 32)
            throw new InvalidOperationException("Security:DeviceHmacKey must be configured (≥ 32 characters).");
        if (string.IsNullOrWhiteSpace(o.AesKey))
            throw new InvalidOperationException("Security:AesKey must be configured (base64 32-byte key recommended).");
        _hmacKey = DeriveKey(o.DeviceHmacKey);
        _aesKey = DeriveKey(o.AesKey);
    }

    /// <summary>Accepts a base64 32-byte key or any passphrase (SHA-256 derived).</summary>
    private static byte[] DeriveKey(string value)
    {
        try
        {
            var bytes = Convert.FromBase64String(value);
            if (bytes.Length == 32) return bytes;
        }
        catch (FormatException) { }
        return SHA256.HashData(Encoding.UTF8.GetBytes(value));
    }

    public string ComputeHash(string rawFingerprint) =>
        Convert.ToHexString(HMACSHA256.HashData(_hmacKey, Encoding.UTF8.GetBytes(rawFingerprint.Trim()))).ToLowerInvariant();

    public byte[] Encrypt(string rawFingerprint)
    {
        var plaintext = Encoding.UTF8.GetBytes(rawFingerprint);
        var nonce = RandomNumberGenerator.GetBytes(AesGcm.NonceByteSizes.MaxSize);
        var tag = new byte[AesGcm.TagByteSizes.MaxSize];
        var cipher = new byte[plaintext.Length];
        using var aes = new AesGcm(_aesKey, tag.Length);
        aes.Encrypt(nonce, plaintext, cipher, tag);
        // layout: nonce(12) | tag(16) | ciphertext
        var output = new byte[nonce.Length + tag.Length + cipher.Length];
        Buffer.BlockCopy(nonce, 0, output, 0, nonce.Length);
        Buffer.BlockCopy(tag, 0, output, nonce.Length, tag.Length);
        Buffer.BlockCopy(cipher, 0, output, nonce.Length + tag.Length, cipher.Length);
        return output;
    }

    public string Mask(string hash)
    {
        if (string.IsNullOrEmpty(hash)) return "—";
        if (hash.Length <= 10) return hash[..2] + "…";
        return $"{hash[..6]}…{hash[^4..]}";
    }
}

public sealed class BcryptOtpHasher : IOtpHasher
{
    private const int WorkFactor = 10; // OTPs live 5 minutes; 10 balances brute-force cost vs. login latency
    public string Hash(string code) => BCrypt.Net.BCrypt.HashPassword(code, WorkFactor);
    public bool Verify(string code, string hash)
    {
        try { return BCrypt.Net.BCrypt.Verify(code, hash); }
        catch (Exception) { return false; }
    }
}

public sealed class SystemDateTimeProvider : IDateTimeProvider
{
    public DateTime UtcNow => DateTime.UtcNow;
}

/// <summary>Exposes <c>Admin:Email</c> (normalised) to the application layer.</summary>
public sealed class AdminSettings : IAdminSettings
{
    public AdminSettings(IOptions<AdminOptions> options) => Email = options.Value.Email.Trim().ToLowerInvariant();
    public string Email { get; }
}
