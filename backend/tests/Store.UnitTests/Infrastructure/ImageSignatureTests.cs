using SixLabors.ImageSharp;
using Store.Application.Common.Exceptions;
using Store.Infrastructure.Images;

namespace Store.UnitTests.Infrastructure;

public class ImageSignatureTests
{
    [Fact]
    public void Detects_jpeg()
    {
        byte[] header = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46];
        Assert.Equal("image/jpeg", ImageSignatures.Detect(header));
    }

    [Fact]
    public void Detects_png()
    {
        byte[] header = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00];
        Assert.Equal("image/png", ImageSignatures.Detect(header));
    }

    [Theory]
    [InlineData("GIF87a")]
    [InlineData("GIF89a")]
    public void Detects_gif(string magic)
    {
        var header = System.Text.Encoding.ASCII.GetBytes(magic + "\0\0\0\0");
        Assert.Equal("image/gif", ImageSignatures.Detect(header));
    }

    [Fact]
    public void Detects_webp()
    {
        var header = System.Text.Encoding.ASCII.GetBytes("RIFF\0\0\0\0WEBPVP8 ");
        Assert.Equal("image/webp", ImageSignatures.Detect(header));
    }

    [Fact]
    public void Rejects_executables_and_renamed_files()
    {
        byte[] exe = [0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]; // "MZ"
        byte[] pdf = System.Text.Encoding.ASCII.GetBytes("%PDF-1.7\n");
        byte[] html = System.Text.Encoding.ASCII.GetBytes("<html><script>");
        byte[] riffNotWebp = System.Text.Encoding.ASCII.GetBytes("RIFF\0\0\0\0WAVEfmt ");

        Assert.Null(ImageSignatures.Detect(exe));
        Assert.Null(ImageSignatures.Detect(pdf));
        Assert.Null(ImageSignatures.Detect(html));
        Assert.Null(ImageSignatures.Detect(riffNotWebp));
        Assert.Null(ImageSignatures.Detect(ReadOnlySpan<byte>.Empty));
        Assert.Null(ImageSignatures.Detect([0xFF, 0xD8])); // truncated
    }

    [Fact]
    public async Task Processor_rejects_non_image_payload_with_validation_error()
    {
        var processor = new ImageSharpProcessor();
        using var stream = new MemoryStream(System.Text.Encoding.ASCII.GetBytes("MZ this is definitely not an image"));

        var ex = await Assert.ThrowsAsync<ValidationException>(() => processor.ProcessAsync(stream));
        Assert.Equal(ErrorCodes.ValidationError, ex.ErrorCode);
        Assert.True(ex.FieldErrors!.ContainsKey("file"));
    }

    [Fact]
    public async Task Processor_rejects_empty_payload()
    {
        var processor = new ImageSharpProcessor();
        using var stream = new MemoryStream();
        await Assert.ThrowsAsync<ValidationException>(() => processor.ProcessAsync(stream));
    }

    [Fact]
    public async Task Processor_rejects_oversized_payload_before_decoding()
    {
        var processor = new ImageSharpProcessor();
        var bytes = new byte[ImageSharpProcessor.MaxBytes + 1];
        bytes[0] = 0xFF; bytes[1] = 0xD8; bytes[2] = 0xFF; // looks like a JPEG
        using var stream = new MemoryStream(bytes);

        var ex = await Assert.ThrowsAsync<ValidationException>(() => processor.ProcessAsync(stream));
        Assert.Contains("5", ex.FieldErrors!["file"]);
    }

    [Fact]
    public async Task Processor_converts_a_real_png_to_webp_with_thumbnail()
    {
        var processor = new ImageSharpProcessor();
        using var source = new SixLabors.ImageSharp.Image<SixLabors.ImageSharp.PixelFormats.Rgba32>(2000, 1200);
        using var input = new MemoryStream();
        await source.SaveAsPngAsync(input);
        input.Position = 0;

        var result = await processor.ProcessAsync(input);

        Assert.Equal("image/webp", result.ContentType);
        Assert.Equal(".webp", result.Extension);
        Assert.Equal("image/webp", ImageSignatures.Detect(result.Main));
        Assert.Equal("image/webp", ImageSignatures.Detect(result.Thumbnail));

        using var main = SixLabors.ImageSharp.Image.Load(result.Main);
        using var thumb = SixLabors.ImageSharp.Image.Load(result.Thumbnail);
        Assert.Equal(ImageSharpProcessor.MaxDimension, Math.Max(main.Width, main.Height));
        Assert.Equal(ImageSharpProcessor.ThumbnailDimension, Math.Max(thumb.Width, thumb.Height));
    }
}
