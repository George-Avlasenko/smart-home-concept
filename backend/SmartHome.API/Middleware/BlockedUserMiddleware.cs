using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartHome.API.Models;

namespace SmartHome.API.Middleware;

/// <summary>Прерывает запросы заблокированного пользователя с уже выданным JWT.</summary>
public class BlockedUserMiddleware
{
    private readonly RequestDelegate _next;

    public BlockedUserMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, SmartHomeContext db)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var userIdClaim = context.User.FindFirst("userId")?.Value
                ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out var userId))
            {
                var isBlocked = await db.Users.AsNoTracking()
                    .Where(u => u.UserId == userId)
                    .Select(u => u.IsBlocked)
                    .FirstOrDefaultAsync(context.RequestAborted);

                if (isBlocked == true)
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/json; charset=utf-8";
                    await context.Response.WriteAsync(
                        JsonSerializer.Serialize(new
                        {
                            code = "account_blocked",
                            error = "Ваш аккаунт заблокирован администратором."
                        }),
                        context.RequestAborted);
                    return;
                }
            }
        }

        await _next(context);
    }
}
