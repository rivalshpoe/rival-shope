using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Store.Application.Common.Exceptions;
using Store.Application.Features.AdminAuth;

namespace Store.Api.Controllers.Admin;

/// <summary>OTP e-mail login for the single admin. Refresh token lives only in the <c>rival_refresh</c> HttpOnly cookie.</summary>
[Route("api/v1/admin/auth")]
public sealed class AdminAuthController : ApiControllerBase
{
    public const string RefreshCookieName = "rival_refresh";
    private const string CookiePath = "/api/v1/admin/auth";

    public sealed record RequestOtpRequest(string? Email);
    public sealed record VerifyOtpRequest(string? Email, string? Code);
    public sealed record TokenResponse(bool Success, string AccessToken, int ExpiresIn);

    [HttpPost("request-otp")]
    [AllowAnonymous]
    public async Task<IActionResult> RequestOtp([FromBody] RequestOtpRequest request, CancellationToken ct) =>
        Success(await Sender.Send(new RequestOtpCommand(request.Email), ct));

    [HttpPost("verify-otp")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpRequest request, CancellationToken ct)
    {
        var tokens = await Sender.Send(new VerifyOtpCommand(request.Email, request.Code), ct);
        SetRefreshCookie(tokens.RefreshToken, tokens.RefreshExpiresAt);
        return Success(new TokenResponse(true, tokens.AccessToken, tokens.ExpiresIn));
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh(CancellationToken ct)
    {
        var raw = Request.Cookies[RefreshCookieName];
        AuthTokensDto tokens;
        try
        {
            tokens = await Sender.Send(new RefreshTokenCommand(raw), ct);
        }
        catch (UnauthorizedException)
        {
            // Expired / revoked / reused token: clear the cookie so the browser stops retrying with it.
            Response.Cookies.Delete(RefreshCookieName, CookieOptions(expiresUtc: null));
            throw;
        }
        SetRefreshCookie(tokens.RefreshToken, tokens.RefreshExpiresAt);
        return Success(new TokenResponse(true, tokens.AccessToken, tokens.ExpiresIn));
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        await Sender.Send(new LogoutCommand(Request.Cookies[RefreshCookieName]), ct);
        Response.Cookies.Delete(RefreshCookieName, CookieOptions(expiresUtc: null));
        return SuccessNoContent();
    }

    [HttpGet("me")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Me(CancellationToken ct) =>
        Success(await Sender.Send(new GetCurrentAdminQuery(), ct));

    private void SetRefreshCookie(string rawToken, DateTime expiresUtc) =>
        Response.Cookies.Append(RefreshCookieName, rawToken, CookieOptions(expiresUtc));

    /// <summary>
    /// HttpOnly persistent cookie. Secure follows the request so the cookie is actually stored
    /// while the site is still served over HTTP; HTTPS turns Secure on automatically.
    /// </summary>
    private CookieOptions CookieOptions(DateTime? expiresUtc)
    {
        var options = new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = CookiePath,
            IsEssential = true
        };
        if (expiresUtc is DateTime expires)
        {
            var utc = expires.Kind == DateTimeKind.Utc ? expires : DateTime.SpecifyKind(expires, DateTimeKind.Utc);
            options.Expires = new DateTimeOffset(utc);
            var remaining = utc - DateTime.UtcNow;
            if (remaining > TimeSpan.Zero) options.MaxAge = remaining;
        }
        return options;
    }
}
