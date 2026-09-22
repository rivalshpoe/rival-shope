namespace Store.Domain.Exceptions;

/// <summary>Raised when a domain invariant is violated (mapped to 409 CONFLICT by the API unless a more specific code is provided).</summary>
public class DomainException : Exception
{
    public string ErrorCode { get; }

    public DomainException(string message, string errorCode = "CONFLICT") : base(message)
    {
        ErrorCode = errorCode;
    }
}
