using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartHome.API.Services;

namespace SmartHome.API.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class EventsController : ControllerBase
{
    private readonly EventPublisher _eventPublisher;
    private readonly ILogger<EventsController> _logger;

    public EventsController(EventPublisher eventPublisher, ILogger<EventsController> logger)
    {
        _eventPublisher = eventPublisher;
        _logger = logger;
    }

    [HttpGet("subscribe")]
    public async Task Subscribe()
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null)
        {
            Response.StatusCode = 401;
            return;
        }

        var userId = claim.Value;

        Response.ContentType = "text/event-stream";
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Connection", "keep-alive");
        Response.Headers.Append("X-Accel-Buffering", "no"); // Отключаем буферизацию для nginx

        var writer = new StreamWriter(Response.Body, Encoding.UTF8)
        {
            AutoFlush = false // Отключаем AutoFlush, используем только FlushAsync
        };

        // Отправляем начальное сообщение
        await writer.WriteLineAsync("data: {\"type\":\"connected\"}\n");
        await writer.FlushAsync();

        _eventPublisher.Subscribe(userId, writer);
        Console.WriteLine($"[EventsController] User {userId} subscribed to events");
        _logger.LogInformation($"User {userId} subscribed to events");
        
        var subscriberCount = _eventPublisher.GetActiveSubscribersCount();
        Console.WriteLine($"[EventsController] Total active subscribers: {subscriberCount}");

        try
        {
            // Держим соединение открытым
            while (!HttpContext.RequestAborted.IsCancellationRequested)
            {
                await Task.Delay(30000, HttpContext.RequestAborted); // Отправляем ping каждые 30 секунд
                await writer.WriteLineAsync(": ping\n");
                await writer.FlushAsync();
            }
        }
        catch (OperationCanceledException)
        {
            // Клиент отключился
        }
        finally
        {
            _eventPublisher.Unsubscribe(userId, writer);
            _logger.LogInformation($"User {userId} unsubscribed from events");
        }
    }
}

