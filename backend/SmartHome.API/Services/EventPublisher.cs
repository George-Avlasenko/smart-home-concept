using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;

namespace SmartHome.API.Services;

public class EventPublisher
{
    private readonly ConcurrentDictionary<string, List<StreamWriter>> _subscribers = new();
    private readonly ILogger<EventPublisher>? _logger;
    
    public EventPublisher(ILogger<EventPublisher>? logger = null)
    {
        _logger = logger;
    }

    public void Subscribe(string userId, StreamWriter writer)
    {
        _subscribers.AddOrUpdate(
            userId,
            new List<StreamWriter> { writer },
            (key, existing) =>
            {
                lock (existing)
                {
                    existing.Add(writer);
                }
                return existing;
            }
        );
    }

    public void Unsubscribe(string userId, StreamWriter writer)
    {
        if (_subscribers.TryGetValue(userId, out var writers))
        {
            lock (writers)
            {
                writers.Remove(writer);
                if (writers.Count == 0)
                {
                    _subscribers.TryRemove(userId, out _);
                }
            }
        }
    }

    public async Task PublishAsync<T>(string eventType, T data)
    {
        var message = new
        {
            type = eventType,
            data = data,
            timestamp = DateTime.UtcNow
        };

        var json = JsonSerializer.Serialize(message);
        var bytes = Encoding.UTF8.GetBytes($"data: {json}\n\n");

        var totalSubscribers = _subscribers.Values.Sum(writers => writers.Count);
        Console.WriteLine($"[EventPublisher] Publishing event '{eventType}' to {totalSubscribers} subscribers");
        _logger?.LogInformation($"Publishing event '{eventType}' to {totalSubscribers} subscribers");
        
        if (totalSubscribers == 0)
        {
            Console.WriteLine($"[EventPublisher] WARNING: No subscribers connected!");
            return;
        }

        var tasks = new List<Task>();
        var deadWriters = new List<(List<StreamWriter> list, StreamWriter writer)>();

        foreach (var subscriber in _subscribers.Values)
        {
            lock (subscriber)
            {
                foreach (var writer in subscriber.ToList())
                {
                    try
                    {
                        // Проверяем, что поток доступен для записи
                        if (writer.BaseStream?.CanWrite == true)
                        {
                            tasks.Add(writer.BaseStream.WriteAsync(bytes, 0, bytes.Length));
                            tasks.Add(writer.FlushAsync());
                        }
                        else
                        {
                            _logger?.LogWarning("Stream is not writable, marking as dead");
                            deadWriters.Add((subscriber, writer));
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger?.LogWarning($"Failed to send event to subscriber: {ex.Message}");
                        deadWriters.Add((subscriber, writer));
                    }
                }
            }
        }

        // Удаляем неактивные соединения после отправки
        foreach (var (list, writer) in deadWriters)
        {
            lock (list)
            {
                list.Remove(writer);
                try
                {
                    writer?.Dispose();
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning($"Error disposing dead writer: {ex.Message}");
                }
            }
        }

        try
        {
            await Task.WhenAll(tasks);
            _logger?.LogInformation($"Event '{eventType}' published successfully");
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, $"Error publishing event '{eventType}'");
        }
    }

    public int GetActiveSubscribersCount()
    {
        return _subscribers.Values.Sum(writers => writers.Count);
    }

    /// <summary>
    /// Возвращает ID пользователей, у которых сейчас открыта подписка SSE (активны в приложении).
    /// </summary>
    public IReadOnlySet<int> GetActiveUserIds()
    {
        var ids = new HashSet<int>();
        foreach (var key in _subscribers.Keys)
        {
            if (int.TryParse(key, out var id) && _subscribers.TryGetValue(key, out var writers))
            {
                lock (writers)
                {
                    if (writers.Count > 0)
                        ids.Add(id);
                }
            }
        }
        return ids;
    }
}







