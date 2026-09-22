using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Store.IntegrationTests;

/// <summary>Tests that exercise the HTTP pipeline without needing a database.</summary>
public class PipelineTests : IClassFixture<RivalApiFactory>
{
    private readonly HttpClient _client;

    public PipelineTests(RivalApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Admin_routes_require_a_bearer_token_and_return_the_error_envelope()
    {
        var response = await _client.GetAsync("/api/v1/admin/orders");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal("UNAUTHORIZED", body.GetProperty("errorCode").GetString());
        Assert.False(string.IsNullOrEmpty(body.GetProperty("correlationId").GetString()));
    }

    [Fact]
    public async Task Correlation_id_is_echoed_and_security_headers_are_present()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/auth/me");
        request.Headers.Add("X-Correlation-Id", "test-corr-123");

        var response = await _client.SendAsync(request);

        Assert.Equal("test-corr-123", response.Headers.GetValues("X-Correlation-Id").Single());
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.True(response.Headers.Contains("Content-Security-Policy"));
    }

    [Fact]
    public async Task Search_query_over_100_chars_returns_400_SEARCH_TOO_LONG()
    {
        var response = await _client.GetAsync("/api/v1/search?q=" + new string('x', 101));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("SEARCH_TOO_LONG", body.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task Creating_an_order_without_Idempotency_Key_returns_400()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/orders", new { items = Array.Empty<object>() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("BAD_REQUEST", body.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task Malformed_json_returns_400_BAD_REQUEST_envelope()
    {
        using var content = new StringContent("{ not json", System.Text.Encoding.UTF8, "application/json");
        var response = await _client.PostAsync("/api/v1/discount-codes/validate", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("BAD_REQUEST", body.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task Order_validation_errors_return_422_with_field_errors()
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/orders")
        {
            Content = JsonContent.Create(new
            {
                items = new[] { new { productId = Guid.NewGuid(), quantity = 0 } },
                needsDelivery = false,
                customerName = "",
                phoneNumber = "abc",
                whatsAppCountryCode = "970"
            })
        };
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());
        request.Headers.Add("X-Device-Fingerprint", "test-device");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("errorCode").GetString());
        var fields = body.GetProperty("fieldErrors");
        Assert.True(fields.TryGetProperty("input.customerName", out _));
        Assert.True(fields.TryGetProperty("input.phoneNumber", out _));
    }

    [Fact]
    public async Task Swagger_is_served_in_development()
    {
        var response = await _client.GetAsync("/swagger/v1/swagger.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}

/// <summary>Database-backed scenarios — enabled with RIVAL_RUN_DB_TESTS=1 against docker-compose PostgreSQL.</summary>
public class DatabaseTests : IClassFixture<RivalApiFactory>
{
    private readonly HttpClient _client;
    public DatabaseTests(RivalApiFactory factory) => _client = factory.CreateClient();

    [Fact(Skip = "Requires PostgreSQL (set RIVAL_RUN_DB_TESTS=1 and run docker compose up postgres redis)")]
    public async Task Health_reports_postgres_healthy()
    {
        var response = await _client.GetAsync("/api/v1/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact(Skip = "Requires PostgreSQL (set RIVAL_RUN_DB_TESTS=1 and run docker compose up postgres redis)")]
    public async Task Public_categories_include_the_six_seeded_roots()
    {
        var body = await _client.GetFromJsonAsync<JsonElement>("/api/v1/categories");
        Assert.Equal(6, body.GetProperty("data").GetArrayLength());
    }
}
