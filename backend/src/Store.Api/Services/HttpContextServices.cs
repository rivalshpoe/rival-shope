using System.Security.Claims;
using Store.Api.Middleware;
using Store.Application.Common.Interfaces;

namespace Store.Api.Services;

public sealed class CurrentAdminService : ICurrentAdminService
{
    private readonly IHttpContextAccessor _accessor;
    public CurrentAdminService(IHttpContextAccessor accessor) => _accessor = accessor;

    private ClaimsPrincipal? User => _accessor.HttpContext?.User;

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated == true && User.IsInRole("Admin");

    public Guid? AdminId
    {
        get
        {
            var sub = User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? User?.FindFirstValue("sub");
            return Guid.TryParse(sub, out var id) ? id : null;
        }
    }

    public string? Email => User?.FindFirstValue(ClaimTypes.Email) ?? User?.FindFirstValue("email");
}

public sealed class HttpRequestContext : IRequestContext
{
    public const string FingerprintHeader = "X-Device-Fingerprint";
    private readonly IHttpContextAccessor _accessor;
    public HttpRequestContext(IHttpContextAccessor accessor) => _accessor = accessor;

    private HttpContext? Ctx => _accessor.HttpContext;

    public string? IpAddress => Ctx?.Connection.RemoteIpAddress?.ToString();

    public string? DeviceFingerprint
    {
        get
        {
            var value = Ctx?.Request.Headers[FingerprintHeader].FirstOrDefault();
            if (string.IsNullOrWhiteSpace(value)) return null;
            value = value.Trim();
            return value.Length > 256 ? value[..256] : value;
        }
    }

    public string CorrelationId =>
        Ctx?.Items[CorrelationIdMiddleware.ItemKey] as string ?? Ctx?.TraceIdentifier ?? Guid.NewGuid().ToString();

    public string? UserAgent => Ctx?.Request.Headers.UserAgent.FirstOrDefault();
}
