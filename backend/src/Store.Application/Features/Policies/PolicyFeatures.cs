using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Caching;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;
using Store.Domain.Entities;

namespace Store.Application.Features.Policies;

public sealed record PolicyDto(string Key, string Title, string Content, DateTime UpdatedAt);
public sealed record PolicyInput(string Title, string Content);

public sealed record GetPoliciesQuery(bool BypassCache = false) : IRequest<IReadOnlyList<PolicyDto>>;
public sealed record GetPolicyByKeyQuery(string Key) : IRequest<PolicyDto>;
public sealed record UpdatePolicyCommand(string Key, PolicyInput Input) : IRequest<PolicyDto>;

public sealed class UpdatePolicyCommandValidator : AbstractValidator<UpdatePolicyCommand>
{
    public UpdatePolicyCommandValidator()
    {
        RuleFor(x => x.Key).Must(k => Policy.AllowedKeys.Contains(k)).WithMessage("مفتاح السياسة غير معروف.");
        RuleFor(x => x.Input.Title).NotEmpty().WithMessage("العنوان مطلوب.").MaximumLength(200).WithMessage("العنوان طويل جدًا.");
        RuleFor(x => x.Input.Content).NotEmpty().WithMessage("المحتوى مطلوب.").MaximumLength(20000).WithMessage("المحتوى طويل جدًا.");
    }
}

internal static class PolicyMapping
{
    public static PolicyDto ToDto(Policy p) => new(p.Key, p.Title, p.Content, p.UpdatedAt ?? p.CreatedAt);
}

public sealed class GetPoliciesQueryHandler : IRequestHandler<GetPoliciesQuery, IReadOnlyList<PolicyDto>>
{
    private readonly IApplicationDbContext _db; private readonly ICacheService _cache;
    public GetPoliciesQueryHandler(IApplicationDbContext db, ICacheService cache) { _db = db; _cache = cache; }

    public Task<IReadOnlyList<PolicyDto>> Handle(GetPoliciesQuery request, CancellationToken ct)
    {
        if (request.BypassCache) return Load(ct);
        return _cache.GetOrSetAsync(CacheKeys.PoliciesAll, CacheKeys.Ttl.Policies, Load, ct);
    }

    private async Task<IReadOnlyList<PolicyDto>> Load(CancellationToken ct)
    {
        var list = await _db.Policies.AsNoTracking().ToListAsync(ct);
        var order = Policy.AllowedKeys.ToList();
        return list.OrderBy(p => order.IndexOf(p.Key)).Select(PolicyMapping.ToDto).ToList();
    }
}

public sealed class GetPolicyByKeyQueryHandler : IRequestHandler<GetPolicyByKeyQuery, PolicyDto>
{
    private readonly IApplicationDbContext _db; private readonly ICacheService _cache;
    public GetPolicyByKeyQueryHandler(IApplicationDbContext db, ICacheService cache) { _db = db; _cache = cache; }

    public async Task<PolicyDto> Handle(GetPolicyByKeyQuery request, CancellationToken ct)
    {
        var key = request.Key.Trim().ToLowerInvariant();
        if (!Policy.AllowedKeys.Contains(key)) throw new NotFoundException("السياسة", key);
        var dto = await _cache.GetOrSetAsync<PolicyDto?>(CacheKeys.Policy(key), CacheKeys.Ttl.Policies, async c =>
        {
            var p = await _db.Policies.AsNoTracking().FirstOrDefaultAsync(x => x.Key == key, c);
            return p is null ? null : PolicyMapping.ToDto(p);
        }, ct);
        return dto ?? throw new NotFoundException("السياسة", key);
    }
}

public sealed class UpdatePolicyCommandHandler : IRequestHandler<UpdatePolicyCommand, PolicyDto>
{
    private readonly IApplicationDbContext _db; private readonly ICacheService _cache; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public UpdatePolicyCommandHandler(IApplicationDbContext db, ICacheService cache, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _cache = cache; _audit = audit; _clock = clock; }

    public async Task<PolicyDto> Handle(UpdatePolicyCommand request, CancellationToken ct)
    {
        var key = request.Key.Trim().ToLowerInvariant();
        var now = _clock.UtcNow;
        var policy = await _db.Policies.FirstOrDefaultAsync(p => p.Key == key, ct);
        if (policy is null)
        {
            policy = new Policy { Key = key, CreatedAt = now };
            _db.Policies.Add(policy);
        }
        policy.Title = request.Input.Title.Trim();
        policy.Content = request.Input.Content.Trim();
        policy.UpdatedAt = now;
        _audit.Log("PolicyUpdated", nameof(Policy), policy.Id, key);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.PoliciesAsync(_cache, key, ct);
        return PolicyMapping.ToDto(policy);
    }
}
