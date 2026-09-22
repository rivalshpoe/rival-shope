using MediatR;
using Microsoft.AspNetCore.Mvc;
using Store.Api.Models;

namespace Store.Api.Controllers;

[ApiController]
[Produces("application/json")]
public abstract class ApiControllerBase : ControllerBase
{
    private ISender? _sender;
    protected ISender Sender => _sender ??= HttpContext.RequestServices.GetRequiredService<ISender>();

    /// <summary>200 with the uniform success envelope.</summary>
    protected OkObjectResult Success<T>(T data) => base.Ok(ApiResponse<T>.Ok(data));

    /// <summary>201 with the uniform success envelope.</summary>
    protected ObjectResult Created<T>(T data) => StatusCode(StatusCodes.Status201Created, ApiResponse<T>.Ok(data));

    /// <summary>200 with <c>{ success: true, data: null }</c> for commands without a payload.</summary>
    protected OkObjectResult SuccessNoContent() => base.Ok(new ApiResponse<object?> { Data = null });
}
