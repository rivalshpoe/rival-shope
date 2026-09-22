using System.Security.Cryptography;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;
using Store.Domain.Entities;

namespace Store.Application.Features.AdminAuth;

public sealed record RequestOtpResultDto(bool Success, int ExpiresInSeconds, int ResendAvailableInSeconds);
/// <summary>Access token for the body; the raw refresh token is only ever written into the HttpOnly cookie by the controller.</summary>
public sealed record AuthTokensDto(string AccessToken, int ExpiresIn, string RefreshToken, DateTime RefreshExpiresAt);
public sealed record AdminMeDto(string Email);

public sealed record RequestOtpCommand(string? Email) : IRequest<RequestOtpResultDto>;
public sealed record VerifyOtpCommand(string? Email, string? Code) : IRequest<AuthTokensDto>;
public sealed record RefreshTokenCommand(string? RefreshToken) : IRequest<AuthTokensDto>;
public sealed record LogoutCommand(string? RefreshToken) : IRequest;
public sealed record GetCurrentAdminQuery() : IRequest<AdminMeDto>;

public sealed class RequestOtpCommandValidator : AbstractValidator<RequestOtpCommand>
{
    public RequestOtpCommandValidator() =>
        RuleFor(x => x.Email).NotEmpty().WithMessage("البريد الإلكتروني مطلوب.").EmailAddress().WithMessage("البريد الإلكتروني غير صالح.").MaximumLength(254);
}

public sealed class VerifyOtpCommandValidator : AbstractValidator<VerifyOtpCommand>
{
    public VerifyOtpCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().WithMessage("البريد الإلكتروني مطلوب.").EmailAddress().WithMessage("البريد الإلكتروني غير صالح.");
        RuleFor(x => x.Code).NotEmpty().WithMessage("رمز التحقق مطلوب.").Matches(@"^\d{6}$").WithMessage("رمز التحقق يتكون من 6 أرقام.");
    }
}

public static class OtpPolicy
{
    public const int OtpRequestsPerHour = 3;
    public static readonly TimeSpan OtpRequestWindow = TimeSpan.FromHours(1);
    public static string RateLimitKey(string email) => $"otp:email:{email}";
}

public sealed class RequestOtpCommandHandler : IRequestHandler<RequestOtpCommand, RequestOtpResultDto>
{
    private readonly IApplicationDbContext _db;
    private readonly IOtpHasher _hasher;
    private readonly IEmailSender _email;
    private readonly IRateLimiter _rateLimiter;
    private readonly IAuditLogger _audit;
    private readonly IDateTimeProvider _clock;
    private readonly IAdminSettings _adminSettings;
    private readonly ILogger<RequestOtpCommandHandler> _logger;

    public RequestOtpCommandHandler(IApplicationDbContext db, IOtpHasher hasher, IEmailSender email, IRateLimiter rateLimiter,
        IAuditLogger audit, IDateTimeProvider clock, IAdminSettings adminSettings, ILogger<RequestOtpCommandHandler> logger)
    {
        _db = db; _hasher = hasher; _email = email; _rateLimiter = rateLimiter; _audit = audit; _clock = clock; _adminSettings = adminSettings; _logger = logger;
    }

    public async Task<RequestOtpResultDto> Handle(RequestOtpCommand request, CancellationToken ct)
    {
        var email = request.Email!.Trim().ToLowerInvariant();
        var now = _clock.UtcNow;
        var expiresIn = AdminOtpCode.ExpiryMinutes * 60;

        // Only the e-mail fixed in configuration (Admin:Email) AND present as an active AdminUser may receive a code.
        var admin = email == _adminSettings.Email
            ? await _db.AdminUsers.AsNoTracking().FirstOrDefaultAsync(a => a.Email == email && a.IsActive, ct)
            : null;
        if (admin is null)
        {
            // Same response shape for unknown emails (no account enumeration); nothing is sent.
            _logger.LogWarning("OTP requested for non-admin email (masked): {Email}", Mask(email));
            _audit.Log("OtpRequestRejected", nameof(AdminUser), null, "unknown email", adminEmailOverride: Mask(email));
            await _db.SaveChangesAsync(ct);
            return new RequestOtpResultDto(true, expiresIn, AdminOtpCode.CooldownSeconds);
        }

        // 60s cooldown between requests for the same email.
        var last = await _db.AdminOtpCodes.AsNoTracking().Where(c => c.Email == email).OrderByDescending(c => c.CreatedAt).FirstOrDefaultAsync(ct);
        if (last is not null)
        {
            var since = now - last.CreatedAt;
            if (since < TimeSpan.FromSeconds(AdminOtpCode.CooldownSeconds))
            {
                var wait = (int)Math.Ceiling(AdminOtpCode.CooldownSeconds - since.TotalSeconds);
                throw new RateLimitedException($"يرجى الانتظار {wait} ثانية قبل طلب رمز جديد.", ErrorCodes.RateLimited, wait);
            }
        }

        // Max 3 OTP requests / hour / email (Redis sliding window with in-memory fail-over).
        var rl = await _rateLimiter.HitAsync(OtpPolicy.RateLimitKey(email), OtpPolicy.OtpRequestsPerHour, OtpPolicy.OtpRequestWindow, ct);
        if (!rl.Allowed)
            throw new RateLimitedException("تم تجاوز عدد طلبات رمز التحقق المسموح بها، حاول بعد ساعة.", ErrorCodes.RateLimited, rl.RetryAfterSeconds);

        // Invalidate previous unused codes, then issue a fresh one.
        await _db.AdminOtpCodes.Where(c => c.Email == email && !c.IsUsed)
            .ExecuteUpdateAsync(c => c.SetProperty(x => x.IsUsed, true).SetProperty(x => x.UpdatedAt, now), ct);

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        _db.AdminOtpCodes.Add(new AdminOtpCode
        {
            Email = email,
            CodeHash = _hasher.Hash(code),
            ExpiresAt = now.AddMinutes(AdminOtpCode.ExpiryMinutes),
            CreatedAt = now
        });
        _audit.Log("OtpRequested", nameof(AdminUser), admin.Id, null, adminEmailOverride: email);

        try
        {
            await _email.SendAsync(email, "رمز الدخول إلى Rival", BuildHtml(code), ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to send OTP email");
            throw new ExternalServiceException("تعذّر إرسال رمز التحقق حاليًا، حاول لاحقًا.", ErrorCodes.EmailFailed);
        }

        await _db.SaveChangesAsync(ct);
        return new RequestOtpResultDto(true, expiresIn, AdminOtpCode.CooldownSeconds);
    }

    private static string BuildHtml(string code) =>
        $"""
         <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;color:#222">
           <p>رمز الدخول إلى Rival هو <strong>{code}</strong></p>
           <p>صالح لمدة {AdminOtpCode.ExpiryMinutes} دقائق.</p>
           <p>إذا لم تطلبي هذا الرمز، تجاهلي الرسالة.</p>
         </div>
         """;

    private static string Mask(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 1) return "***";
        return email[0] + "***" + email[(at - 1)..];
    }
}

public sealed class VerifyOtpCommandHandler : IRequestHandler<VerifyOtpCommand, AuthTokensDto>
{
    private readonly IApplicationDbContext _db;
    private readonly IOtpHasher _hasher;
    private readonly IJwtTokenGenerator _jwt;
    private readonly IAuditLogger _audit;
    private readonly IDateTimeProvider _clock;
    private readonly IRequestContext _request;

    public VerifyOtpCommandHandler(IApplicationDbContext db, IOtpHasher hasher, IJwtTokenGenerator jwt, IAuditLogger audit, IDateTimeProvider clock, IRequestContext request)
    {
        _db = db; _hasher = hasher; _jwt = jwt; _audit = audit; _clock = clock; _request = request;
    }

    public async Task<AuthTokensDto> Handle(VerifyOtpCommand request, CancellationToken ct)
    {
        var email = request.Email!.Trim().ToLowerInvariant();
        var now = _clock.UtcNow;

        var admin = await _db.AdminUsers.FirstOrDefaultAsync(a => a.Email == email && a.IsActive, ct);
        var otp = await _db.AdminOtpCodes.Where(c => c.Email == email && !c.IsUsed).OrderByDescending(c => c.CreatedAt).FirstOrDefaultAsync(ct);

        if (admin is null || otp is null || !otp.IsValidAt(now))
        {
            _audit.Log("LoginFailed", nameof(AdminUser), admin?.Id, "no valid otp", adminEmailOverride: email);
            await _db.SaveChangesAsync(ct);
            throw new UnauthorizedException("رمز التحقق غير صالح أو منتهي، اطلب رمزًا جديدًا.");
        }

        if (!_hasher.Verify(request.Code!, otp.CodeHash))
        {
            var invalidated = otp.RegisterFailedAttempt();
            otp.UpdatedAt = now;
            _audit.Log("LoginFailed", nameof(AdminUser), admin.Id, invalidated ? "otp invalidated after max attempts" : $"wrong code (attempt {otp.AttemptsCount})", adminEmailOverride: email);
            await _db.SaveChangesAsync(ct);
            throw new UnauthorizedException(invalidated
                ? "تم تجاوز عدد المحاولات المسموح بها، اطلب رمزًا جديدًا."
                : "رمز التحقق غير صحيح.");
        }

        otp.IsUsed = true;
        otp.UpdatedAt = now;
        admin.LastLoginAt = now;

        var access = _jwt.GenerateAccessToken(admin.Id, admin.Email);
        var (rawRefresh, refreshHash) = _jwt.GenerateRefreshToken();
        var refreshExpires = now.AddDays(_jwt.RefreshTokenDays);
        _db.RefreshTokens.Add(new RefreshToken
        {
            AdminUserId = admin.Id, TokenHash = refreshHash, ExpiresAt = refreshExpires, CreatedByIp = _request.IpAddress, CreatedAt = now
        });

        _audit.Log("LoginSuccess", nameof(AdminUser), admin.Id, null, adminEmailOverride: email);
        await _db.SaveChangesAsync(ct);

        return new AuthTokensDto(access.Token, access.ExpiresInSeconds, rawRefresh, refreshExpires);
    }
}

public sealed class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, AuthTokensDto>
{
    private readonly IApplicationDbContext _db; private readonly IJwtTokenGenerator _jwt; private readonly IDateTimeProvider _clock; private readonly IRequestContext _request; private readonly IAuditLogger _audit;
    public RefreshTokenCommandHandler(IApplicationDbContext db, IJwtTokenGenerator jwt, IDateTimeProvider clock, IRequestContext request, IAuditLogger audit)
    { _db = db; _jwt = jwt; _clock = clock; _request = request; _audit = audit; }

    public async Task<AuthTokensDto> Handle(RefreshTokenCommand request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken)) throw new UnauthorizedException("انتهت الجلسة، يرجى تسجيل الدخول مجددًا.");
        var now = _clock.UtcNow;
        var hash = _jwt.HashRefreshToken(request.RefreshToken);

        var token = await _db.RefreshTokens.Include(t => t.AdminUser).FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is null || !token.IsActive(now) || !token.AdminUser.IsActive)
        {
            if (token is { RevokedAt: not null })
            {
                // Reuse of a rotated token ⇒ possible theft: revoke the whole chain for this admin.
                await _db.RefreshTokens.Where(t => t.AdminUserId == token.AdminUserId && t.RevokedAt == null)
                    .ExecuteUpdateAsync(t => t.SetProperty(x => x.RevokedAt, now), ct);
                _audit.Log("RefreshTokenReuseDetected", nameof(RefreshToken), token.Id, null, adminEmailOverride: token.AdminUser.Email);
                await _db.SaveChangesAsync(ct);
            }
            throw new UnauthorizedException("انتهت الجلسة، يرجى تسجيل الدخول مجددًا.");
        }

        // Rotation: revoke current, issue a new one.
        var (rawRefresh, newHash) = _jwt.GenerateRefreshToken();
        token.RevokedAt = now;
        token.ReplacedByTokenHash = newHash;
        token.UpdatedAt = now;
        var refreshExpires = now.AddDays(_jwt.RefreshTokenDays);
        _db.RefreshTokens.Add(new RefreshToken
        {
            AdminUserId = token.AdminUserId, TokenHash = newHash, ExpiresAt = refreshExpires, CreatedByIp = _request.IpAddress, CreatedAt = now
        });

        var access = _jwt.GenerateAccessToken(token.AdminUserId, token.AdminUser.Email);
        await _db.SaveChangesAsync(ct);
        return new AuthTokensDto(access.Token, access.ExpiresInSeconds, rawRefresh, refreshExpires);
    }
}

public sealed class LogoutCommandHandler : IRequestHandler<LogoutCommand>
{
    private readonly IApplicationDbContext _db; private readonly IJwtTokenGenerator _jwt; private readonly IDateTimeProvider _clock; private readonly IAuditLogger _audit;
    public LogoutCommandHandler(IApplicationDbContext db, IJwtTokenGenerator jwt, IDateTimeProvider clock, IAuditLogger audit) { _db = db; _jwt = jwt; _clock = clock; _audit = audit; }

    public async Task Handle(LogoutCommand request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken)) return;
        var hash = _jwt.HashRefreshToken(request.RefreshToken);
        var token = await _db.RefreshTokens.Include(t => t.AdminUser).FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is null || token.RevokedAt is not null) return;
        token.RevokedAt = _clock.UtcNow;
        token.UpdatedAt = token.RevokedAt;
        _audit.Log("Logout", nameof(AdminUser), token.AdminUserId, null, adminEmailOverride: token.AdminUser.Email);
        await _db.SaveChangesAsync(ct);
    }
}

public sealed class GetCurrentAdminQueryHandler : IRequestHandler<GetCurrentAdminQuery, AdminMeDto>
{
    private readonly ICurrentAdminService _current;
    public GetCurrentAdminQueryHandler(ICurrentAdminService current) => _current = current;

    public Task<AdminMeDto> Handle(GetCurrentAdminQuery request, CancellationToken ct)
    {
        if (!_current.IsAuthenticated || string.IsNullOrEmpty(_current.Email)) throw new UnauthorizedException();
        return Task.FromResult(new AdminMeDto(_current.Email));
    }
}
