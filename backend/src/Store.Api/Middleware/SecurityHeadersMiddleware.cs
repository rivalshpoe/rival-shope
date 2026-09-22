namespace Store.Api.Middleware;

/// <summary>Mandatory security headers on every response (spec §12). HSTS is added by <c>UseHsts</c> outside Development.</summary>
public sealed class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    public SecurityHeadersMiddleware(RequestDelegate next) => _next = next;

    public Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";
        headers["X-Permitted-Cross-Domain-Policies"] = "none";
        headers["Cross-Origin-Resource-Policy"] = context.Request.Path.StartsWithSegments("/uploads") ? "cross-origin" : "same-site";

        // Swagger UI needs inline scripts/styles; the JSON API itself never renders HTML.
        if (context.Request.Path.StartsWithSegments("/swagger"))
            headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'";
        else
            headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

        headers.Remove("Server");
        headers.Remove("X-Powered-By");
        return _next(context);
    }
}
