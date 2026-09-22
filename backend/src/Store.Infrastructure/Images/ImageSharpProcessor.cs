using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;

namespace Store.Infrastructure.Images;

/// <summary>
/// Validates real file content (magic bytes) and size, strips metadata, and produces WebP (q=82, max 1600px) + 400px thumbnail.
/// </summary>
public sealed class ImageSharpProcessor : IImageProcessor
{
    public const long MaxBytes = 5 * 1024 * 1024;
    public const int MaxDimension = 1600;
    public const int ThumbnailDimension = 400;
    public const int WebpQuality = 82;

    public bool IsSupportedImage(ReadOnlySpan<byte> header) => ImageSignatures.Detect(header) is not null;

    public async Task<ProcessedImage> ProcessAsync(Stream input, CancellationToken ct = default)
    {
        // Buffer once so we can validate magic bytes and size before handing to the decoder.
        using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer, ct);
        if (buffer.Length == 0) throw new ValidationException("file", "الملف فارغ.");
        if (buffer.Length > MaxBytes) throw new ValidationException("file", "حجم الصورة يتجاوز 5 ميغابايت.");

        var bytes = buffer.GetBuffer().AsSpan(0, (int)buffer.Length);
        if (ImageSignatures.Detect(bytes[..Math.Min(bytes.Length, 16)]) is null)
            throw new ValidationException("file", "نوع الملف غير مدعوم. المسموح: JPEG, PNG, WebP, GIF.");

        buffer.Position = 0;
        var decoderOptions = new DecoderOptions { MaxFrames = 1 }; // animated GIFs → first frame only
        using var image = await Image.LoadAsync(decoderOptions, buffer, ct);

        image.Mutate(x => x.AutoOrient());
        image.Metadata.ExifProfile = null;
        image.Metadata.XmpProfile = null;
        image.Metadata.IptcProfile = null;

        var encoder = new WebpEncoder { Quality = WebpQuality, FileFormat = WebpFileFormatType.Lossy };

        var main = await Encode(image, MaxDimension, encoder, ct);
        var thumb = await Encode(image, ThumbnailDimension, encoder, ct);
        return new ProcessedImage(main, thumb, "image/webp", ".webp");
    }

    private static async Task<byte[]> Encode(Image source, int maxSide, IImageEncoder encoder, CancellationToken ct)
    {
        using var clone = source.Clone(x =>
        {
            if (source.Width > maxSide || source.Height > maxSide)
                x.Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(maxSide, maxSide), Sampler = KnownResamplers.Lanczos3 });
        });
        using var ms = new MemoryStream();
        await clone.SaveAsync(ms, encoder, ct);
        return ms.ToArray();
    }
}

/// <summary>Magic-byte signatures for the supported formats (pure, unit-testable).</summary>
public static class ImageSignatures
{
    public static string? Detect(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF) return "image/jpeg";
        if (header.Length >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47
            && header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A) return "image/png";
        if (header.Length >= 6 && header[0] == (byte)'G' && header[1] == (byte)'I' && header[2] == (byte)'F' && header[3] == (byte)'8'
            && (header[4] == (byte)'7' || header[4] == (byte)'9') && header[5] == (byte)'a') return "image/gif";
        if (header.Length >= 12 && header[0] == (byte)'R' && header[1] == (byte)'I' && header[2] == (byte)'F' && header[3] == (byte)'F'
            && header[8] == (byte)'W' && header[9] == (byte)'E' && header[10] == (byte)'B' && header[11] == (byte)'P') return "image/webp";
        return null;
    }
}
