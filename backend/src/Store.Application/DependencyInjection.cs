using System.Reflection;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Store.Application.Common.Behaviors;

namespace Store.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration configuration)
    {
        var assembly = Assembly.GetExecutingAssembly();

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(assembly);
            var key = configuration["MediatR:LicenseKey"];
            if (!string.IsNullOrWhiteSpace(key)) cfg.LicenseKey = key;
            cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
            cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
        });

        services.AddAutoMapper(cfg =>
        {
            var key = configuration["AutoMapper:LicenseKey"];
            if (!string.IsNullOrWhiteSpace(key)) cfg.LicenseKey = key;
        }, assembly);

        services.AddValidatorsFromAssembly(assembly, includeInternalTypes: true);
        ValidatorOptions.Global.LanguageManager.Enabled = false; // messages are supplied explicitly in Arabic

        return services;
    }
}
