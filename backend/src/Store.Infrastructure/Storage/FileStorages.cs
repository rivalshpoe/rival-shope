using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Store.Application.Common.Interfaces;
using Store.Infrastructure.Options;

namespace Store.Infrastructure.Storage;

/// <summary>Writes to <c>wwwroot/uploads</c> (served as static files by the API). Default for local development.</summary>
public sealed class LocalFileStorage : IFileStorage
{
    private readonly string _root;
    private readonly string _publicBase;
    private readonly ILogger<LocalFileStorage> _logger;

    public LocalFileStorage(IOptions<StorageOptions> options, IHostEnvironment env, ILogger<LocalFileStorage> logger)
    {
        var configured = options.Value.LocalRootPath;
        _root = Path.IsPathRooted(configured) ? configured : Path.Combine(env.ContentRootPath, configured);
        _publicBase = options.Value.LocalPublicBaseUrl.TrimEnd('/');
        _logger = logger;
        Directory.CreateDirectory(_root);
    }

    public async Task<string> SaveAsync(Stream content, string fileName, string contentType, CancellationToken ct = default)
    {
        var safeName = Path.GetFileName(fileName); // no path traversal
        var path = Path.Combine(_root, safeName);
        await using (var fs = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 81920, useAsync: true))
            await content.CopyToAsync(fs, ct);
        return $"{_publicBase}/uploads/{safeName}";
    }

    public Task DeleteAsync(string url, CancellationToken ct = default)
    {
        try
        {
            var name = Path.GetFileName(new Uri(url, UriKind.RelativeOrAbsolute).IsAbsoluteUri ? new Uri(url).AbsolutePath : url);
            var path = Path.Combine(_root, name);
            if (File.Exists(path)) File.Delete(path);
        }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to delete local upload {Url}", url); }
        return Task.CompletedTask;
    }
}

/// <summary>DigitalOcean Spaces (S3-compatible) with CDN base URL and immutable long-lived Cache-Control (GUID file names).</summary>
public sealed class SpacesFileStorage : IFileStorage, IDisposable
{
    private readonly SpacesOptions _options;
    private readonly AmazonS3Client _client;
    private readonly ILogger<SpacesFileStorage> _logger;

    public SpacesFileStorage(IOptions<SpacesOptions> options, ILogger<SpacesFileStorage> logger)
    {
        _options = options.Value;
        _logger = logger;
        if (string.IsNullOrWhiteSpace(_options.Bucket) || string.IsNullOrWhiteSpace(_options.AccessKey) || string.IsNullOrWhiteSpace(_options.SecretKey))
            throw new InvalidOperationException("Spaces storage selected but Spaces:Bucket/AccessKey/SecretKey are not configured.");

        var config = new AmazonS3Config
        {
            ServiceURL = _options.Endpoint,
            ForcePathStyle = false,
            AuthenticationRegion = _options.Region,
            // Spaces does not support the newer flexible checksums — behave like classic S3 clients.
            RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
            ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED
        };
        _client = new AmazonS3Client(new BasicAWSCredentials(_options.AccessKey, _options.SecretKey), config);
    }

    public async Task<string> SaveAsync(Stream content, string fileName, string contentType, CancellationToken ct = default)
    {
        var key = string.IsNullOrWhiteSpace(_options.Folder) ? fileName : $"{_options.Folder.Trim('/')}/{fileName}";
        var request = new PutObjectRequest
        {
            BucketName = _options.Bucket,
            Key = key,
            InputStream = content,
            ContentType = contentType,
            CannedACL = S3CannedACL.PublicRead,
            AutoCloseStream = false
        };
        request.Headers.CacheControl = "public, max-age=31536000, immutable";
        await _client.PutObjectAsync(request, ct);

        var baseUrl = string.IsNullOrWhiteSpace(_options.CdnBaseUrl)
            ? $"https://{_options.Bucket}.{new Uri(_options.Endpoint).Host}"
            : _options.CdnBaseUrl.TrimEnd('/');
        return $"{baseUrl}/{key}";
    }

    public async Task DeleteAsync(string url, CancellationToken ct = default)
    {
        try
        {
            var key = new Uri(url).AbsolutePath.TrimStart('/');
            await _client.DeleteObjectAsync(_options.Bucket, key, ct);
        }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to delete Spaces object {Url}", url); }
    }

    public void Dispose() => _client.Dispose();
}
