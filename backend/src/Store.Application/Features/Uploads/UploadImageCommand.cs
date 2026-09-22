using FluentValidation;
using MediatR;
using Store.Application.Common.Exceptions;
using ValidationException = Store.Application.Common.Exceptions.ValidationException;
using Store.Application.Common.Interfaces;

namespace Store.Application.Features.Uploads;

public sealed record UploadResultDto(string Url, string ThumbnailUrl);

/// <summary>Admin image upload: magic-byte validation, ≤5MB, WebP conversion + 400px thumbnail, GUID file names.</summary>
public sealed record UploadImageCommand(Stream Content, long Length, string? OriginalFileName) : IRequest<UploadResultDto>;

public sealed class UploadImageCommandValidator : AbstractValidator<UploadImageCommand>
{
    public const long MaxBytes = 5 * 1024 * 1024;

    public UploadImageCommandValidator()
    {
        RuleFor(x => x.Content).NotNull().WithMessage("الملف مطلوب.");
        RuleFor(x => x.Length).GreaterThan(0).WithMessage("الملف فارغ.").LessThanOrEqualTo(MaxBytes).WithMessage("حجم الصورة يتجاوز 5 ميغابايت.");
    }
}

public sealed class UploadImageCommandHandler : IRequestHandler<UploadImageCommand, UploadResultDto>
{
    private readonly IImageProcessor _images;
    private readonly IFileStorage _storage;
    private readonly IAuditLogger _audit;
    private readonly IApplicationDbContext _db;

    public UploadImageCommandHandler(IImageProcessor images, IFileStorage storage, IAuditLogger audit, IApplicationDbContext db)
    {
        _images = images; _storage = storage; _audit = audit; _db = db;
    }

    public async Task<UploadResultDto> Handle(UploadImageCommand request, CancellationToken ct)
    {
        ProcessedImage processed;
        try
        {
            processed = await _images.ProcessAsync(request.Content, ct);
        }
        catch (AppException) { throw; }
        catch (Exception)
        {
            throw new ValidationException("file", "الملف ليس صورة صالحة (JPEG/PNG/WebP/GIF).");
        }

        var id = Guid.NewGuid().ToString("N");
        var mainName = $"{id}{processed.Extension}";
        var thumbName = $"{id}_thumb{processed.Extension}";

        await using var main = new MemoryStream(processed.Main);
        await using var thumb = new MemoryStream(processed.Thumbnail);
        var url = await _storage.SaveAsync(main, mainName, processed.ContentType, ct);
        var thumbUrl = await _storage.SaveAsync(thumb, thumbName, processed.ContentType, ct);

        _audit.Log("ImageUploaded", "Upload", null, $"{mainName} ({request.OriginalFileName ?? "-"})");
        await _db.SaveChangesAsync(ct);

        return new UploadResultDto(url, thumbUrl);
    }
}
