using System.Net;
using System.Net.Sockets;

namespace SmartHome.API.Services;

/// <summary>
/// Находит доступный HTTP-базовый URL микросервиса tuya-service (на хосте :5055).
/// В Docker шлюз к хосту не всегда 172.17.0.1 и не везде работает host.docker.internal — перебираем варианты и кэшируем успешный.
/// </summary>
public sealed class TuyaServiceLocator
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TuyaServiceLocator> _logger;
    private string? _cachedBaseUrl;
    private readonly object _cacheLock = new();

    public TuyaServiceLocator(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<TuyaServiceLocator> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    public void InvalidateCache()
    {
        lock (_cacheLock) _cachedBaseUrl = null;
    }

    public async Task<string?> GetReachableBaseUrlAsync(CancellationToken cancellationToken = default)
    {
        lock (_cacheLock)
        {
            if (!string.IsNullOrEmpty(_cachedBaseUrl))
                return _cachedBaseUrl;
        }

        foreach (var candidate in BuildCandidates())
        {
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                cts.CancelAfter(TimeSpan.FromSeconds(3));
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(3);
                using var resp = await client.GetAsync($"{candidate.TrimEnd('/')}/health", cts.Token);
                if (resp.IsSuccessStatusCode)
                {
                    var url = candidate.TrimEnd('/');
                    lock (_cacheLock) _cachedBaseUrl = url;
                    _logger.LogInformation("Tuya service доступен по {Url}", url);
                    return url;
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug("Проверка tuya-service {Url}: {Message}", candidate, ex.Message);
            }
        }

        _logger.LogWarning("Не удалось достучаться до tuya-service ни по одному адресу (порт 5055, путь /health)");
        return null;
    }

    private IEnumerable<string> BuildCandidates()
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var u in EnumerateUrls())
        {
            var t = u.TrimEnd('/');
            if (!seen.Add(t)) continue;
            yield return t;
        }
    }

    private IEnumerable<string> EnumerateUrls()
    {
        var configured = _configuration["TuyaService:BaseUrl"]
            ?? Environment.GetEnvironmentVariable("TuyaService__BaseUrl")
            ?? "http://host.docker.internal:5055";
        yield return configured;

        IPAddress[]? resolved = null;
        try
        {
            resolved = Dns.GetHostEntry("host.docker.internal").AddressList;
        }
        catch
        {
            resolved = null;
        }

        if (resolved != null)
        {
            foreach (var a in resolved)
            {
                if (a.AddressFamily == AddressFamily.InterNetwork)
                    yield return $"http://{a}:5055";
            }
        }

        for (var b = 17; b <= 25; b++)
            yield return $"http://172.{b}.0.1:5055";

        yield return "http://host.docker.internal:5055";
    }
}
