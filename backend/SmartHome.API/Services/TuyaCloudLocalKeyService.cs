using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace SmartHome.API.Services;

/// <summary>
/// Достаёт local_key по Device ID через Tuya Open API (как tinytuya с new_sign_algorithm).
/// </summary>
public sealed class TuyaCloudLocalKeyService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly TuyaCloudRuntimeConfig _runtimeConfig;
    private readonly ILogger<TuyaCloudLocalKeyService> _logger;

    private readonly ConcurrentDictionary<string, TokenEntry> _tokenByRegion = new();

    private sealed record TokenEntry(string AccessToken, long ExpiresAtMs);

    public TuyaCloudLocalKeyService(
        IHttpClientFactory httpClientFactory,
        TuyaCloudRuntimeConfig runtimeConfig,
        ILogger<TuyaCloudLocalKeyService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _runtimeConfig = runtimeConfig;
        _logger = logger;
    }

    public bool IsConfigured =>
        _runtimeConfig.Snapshot() is var o &&
        o.Enabled &&
        !string.IsNullOrWhiteSpace(o.AccessId) &&
        !string.IsNullOrWhiteSpace(o.AccessSecret);

    public sealed record DeviceProfile(string? CategoryCode, string? ProductId, string? ProductName, string? LocalKey);

    /// <summary>Возвращает local_key из облака (как в tinytuya getdevices).</summary>
    public async Task<string?> TryGetLocalKeyForDeviceAsync(
        string deviceId,
        CancellationToken cancellationToken = default)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(deviceId))
            return null;

        try
        {
            var opt = _runtimeConfig.Snapshot();
            var host = HostForRegion(opt.Region);
            var token = await EnsureTokenAsync(host, cancellationToken).ConfigureAwait(false);
            if (string.IsNullOrEmpty(token))
                return null;

            var (directKey, uid) = await FetchDeviceDetailKeysAsync(host, token, deviceId.Trim(), cancellationToken).ConfigureAwait(false);
            if (!string.IsNullOrWhiteSpace(directKey))
                return directKey;

            if (string.IsNullOrEmpty(uid))
                return null;

            return await GetLocalKeyFromUserDevicesAsync(host, token, uid, deviceId.Trim(), cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Tuya cloud: не удалось получить local key для {DeviceId}", deviceId);
            return null;
        }
    }

    /// <summary>Профиль устройства из Tuya Cloud (категория + имя + local key).</summary>
    public async Task<DeviceProfile?> TryGetDeviceProfileAsync(
        string deviceId,
        CancellationToken cancellationToken = default)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(deviceId))
            return null;

        try
        {
            var opt = _runtimeConfig.Snapshot();
            var host = HostForRegion(opt.Region);
            var token = await EnsureTokenAsync(host, cancellationToken).ConfigureAwait(false);
            if (string.IsNullOrEmpty(token))
                return null;

            var detail = await FetchDeviceDetailAsync(host, token, deviceId.Trim(), cancellationToken).ConfigureAwait(false);
            if (detail == null)
                return null;

            var category = detail.Value.TryGetProperty("category", out var cat) && cat.ValueKind == JsonValueKind.String
                ? cat.GetString()
                : null;
            var productId = detail.Value.TryGetProperty("product_id", out var pid) && pid.ValueKind == JsonValueKind.String
                ? pid.GetString()
                : null;
            var productName = detail.Value.TryGetProperty("product_name", out var pn) && pn.ValueKind == JsonValueKind.String
                ? pn.GetString()
                : (detail.Value.TryGetProperty("name", out var nm) && nm.ValueKind == JsonValueKind.String ? nm.GetString() : null);
            var localKey = detail.Value.TryGetProperty("local_key", out var lk) && lk.ValueKind == JsonValueKind.String
                ? lk.GetString()
                : null;

            return new DeviceProfile(category, productId, productName, localKey);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Tuya cloud: не удалось получить профиль устройства {DeviceId}", deviceId);
            return null;
        }
    }

    private static string HostForRegion(string region)
    {
        var r = (region ?? "eu").Trim().ToLowerInvariant();
        return r switch
        {
            "us" or "az" => "openapi.tuyaus.com",
            "us-e" or "ue" => "openapi-ueaz.tuyaus.com",
            "eu" or "" => "openapi.tuyaeu.com",
            "eu-w" or "we" => "openapi-weaz.tuyaeu.com",
            "in" => "openapi.tuyain.com",
            "cn" => "openapi.tuyacn.com",
            "sg" => "openapi-sg.iotbing.com",
            _ => "openapi.tuyaeu.com",
        };
    }

    private async Task<string?> EnsureTokenAsync(string host, CancellationToken ct)
    {
        if (!_tokenByRegion.TryGetValue(host, out var entry) || entry.ExpiresAtMs < NowMs() + 60_000)
        {
            var fresh = await FetchTokenAsync(host, ct).ConfigureAwait(false);
            if (fresh == null)
                return null;
            _tokenByRegion[host] = fresh;
            entry = fresh;
        }

        return entry.AccessToken;
    }

    private async Task<TokenEntry?> FetchTokenAsync(string host, CancellationToken ct)
    {
        var opt = _runtimeConfig.Snapshot();
        var url = $"https://{host}/v1.0/token?grant_type=1";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        AddSignedHeaders(req, opt.AccessId, opt.AccessSecret, null, "GET", "", url);

        var http = _httpClientFactory.CreateClient(nameof(TuyaCloudLocalKeyService));
        using var res = await http.SendAsync(req, ct).ConfigureAwait(false);
        var json = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode)
        {
            _logger.LogWarning("Tuya token HTTP {Code}: {Body}", (int)res.StatusCode, json[..Math.Min(400, json.Length)]);
            return null;
        }

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (!root.TryGetProperty("success", out var ok) || !ok.GetBoolean())
        {
            _logger.LogWarning("Tuya token failed: {Json}", json[..Math.Min(500, json.Length)]);
            return null;
        }

        if (!root.TryGetProperty("result", out var result))
            return null;
        var access = result.GetProperty("access_token").GetString();
        long expiresAt;
        if (result.TryGetProperty("expire_time", out var e))
        {
            var v = e.GetInt64();
            expiresAt = v < 1_000_000_000_000 ? NowMs() + v * 1000 : v;
        }
        else
            expiresAt = NowMs() + 3_600_000;
        if (string.IsNullOrEmpty(access))
            return null;
        return new TokenEntry(access, expiresAt);
    }

    private async Task<(string? LocalKey, string? Uid)> FetchDeviceDetailKeysAsync(string host, string token, string deviceId, CancellationToken ct)
    {
        var opt = _runtimeConfig.Snapshot();
        var url = $"https://{host}/v1.0/devices/{deviceId}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        AddSignedHeaders(req, opt.AccessId, opt.AccessSecret, token, "GET", "", url);

        var http = _httpClientFactory.CreateClient(nameof(TuyaCloudLocalKeyService));
        using var res = await http.SendAsync(req, ct).ConfigureAwait(false);
        var json = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode)
        {
            _logger.LogWarning("Tuya devices/{{id}} HTTP {Code}: {Body}", (int)res.StatusCode, json[..Math.Min(300, json.Length)]);
            return (null, null);
        }

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (!root.TryGetProperty("success", out var ok) || !ok.GetBoolean())
            return (null, null);
        if (!root.TryGetProperty("result", out var result))
            return (null, null);

        string? lk = null;
        if (result.TryGetProperty("local_key", out var lkEl) && lkEl.ValueKind == JsonValueKind.String)
            lk = lkEl.GetString();
        var uid = ReadUidFromDeviceDetail(result);
        return (lk, uid);
    }

    private async Task<JsonElement?> FetchDeviceDetailAsync(string host, string token, string deviceId, CancellationToken ct)
    {
        var opt = _runtimeConfig.Snapshot();
        var url = $"https://{host}/v1.0/devices/{deviceId}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        AddSignedHeaders(req, opt.AccessId, opt.AccessSecret, token, "GET", "", url);

        var http = _httpClientFactory.CreateClient(nameof(TuyaCloudLocalKeyService));
        using var res = await http.SendAsync(req, ct).ConfigureAwait(false);
        var json = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode)
            return null;

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (!root.TryGetProperty("success", out var ok) || !ok.GetBoolean())
            return null;
        if (!root.TryGetProperty("result", out var result))
            return null;
        return result.Clone();
    }

    private static string? ReadUidFromDeviceDetail(JsonElement result)
    {
        if (result.TryGetProperty("uid", out var uidEl))
            return uidEl.ValueKind == JsonValueKind.Number ? uidEl.GetInt64().ToString() : uidEl.GetString();
        if (result.TryGetProperty("owner_id", out var owner))
            return owner.ValueKind == JsonValueKind.Number ? owner.GetInt64().ToString() : owner.GetString();
        return null;
    }

    private async Task<string?> GetLocalKeyFromUserDevicesAsync(
        string host,
        string token,
        string uid,
        string deviceId,
        CancellationToken ct)
    {
        var opt = _runtimeConfig.Snapshot();
        var rel = $"users/{uid}/devices";
        var url = $"https://{host}/v1.0/{rel}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        AddSignedHeaders(req, opt.AccessId, opt.AccessSecret, token, "GET", "", url);

        var http = _httpClientFactory.CreateClient(nameof(TuyaCloudLocalKeyService));
        using var res = await http.SendAsync(req, ct).ConfigureAwait(false);
        var json = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode)
        {
            _logger.LogWarning("Tuya users/devices HTTP {Code}: {Body}", (int)res.StatusCode, json[..Math.Min(300, json.Length)]);
            return null;
        }

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (!root.TryGetProperty("success", out var ok) || !ok.GetBoolean())
            return null;
        if (!root.TryGetProperty("result", out var result))
            return null;

        JsonElement list = result;
        if (result.ValueKind == JsonValueKind.Object)
        {
            if (result.TryGetProperty("devices", out var devices))
                list = devices;
            else if (result.TryGetProperty("list", out var lst))
                list = lst;
        }
        if (list.ValueKind != JsonValueKind.Array)
            return null;

        foreach (var dev in list.EnumerateArray())
        {
            var id = dev.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            if (!string.Equals(id, deviceId, StringComparison.Ordinal))
                continue;
            if (dev.TryGetProperty("local_key", out var lk))
                return lk.GetString();
            if (dev.TryGetProperty("localKey", out var lk2))
                return lk2.GetString();
        }

        return null;
    }

    /// <summary>Подпись как в tinytuya Cloud._tuyaplatform (new_sign_algorithm).</summary>
    private static void AddSignedHeaders(
        HttpRequestMessage req,
        string accessId,
        string secret,
        string? accessToken,
        string method,
        string body,
        string fullUrl)
    {
        var t = NowMs().ToString();
        var headers = new Dictionary<string, string>(StringComparer.Ordinal);
        if (req.Content?.Headers.ContentType is { } ct)
            headers["Content-type"] = ct.ToString();

        if (headers.Count > 0)
            headers["Signature-Headers"] = string.Join(':', headers.Keys);

        var payload = accessToken == null
            ? accessId + t
            : accessId + accessToken + t;

        var bodySha = Sha256Hex(body);
        var headerLines = new StringBuilder();
        if (headers.TryGetValue("Signature-Headers", out var sh))
        {
            foreach (var name in sh.Split(':', StringSplitOptions.RemoveEmptyEntries))
            {
                if (headers.TryGetValue(name, out var hv))
                    headerLines.Append(name).Append(':').Append(hv).Append('\n');
            }
        }
        headerLines.Append('\n');

        var urlPath = fullUrl.Contains("//", StringComparison.Ordinal)
            ? fullUrl.Split("//", 2, StringSplitOptions.None)[1].Split('/', 2)[1]
            : fullUrl.TrimStart('/');
        var canonicalUrl = "/" + urlPath;

        payload += method + "\n" + bodySha + "\n" + headerLines + canonicalUrl;

        var sign = HmacSha256UpperHex(secret, payload);

        req.Headers.TryAddWithoutValidation("client_id", accessId);
        req.Headers.TryAddWithoutValidation("sign", sign);
        req.Headers.TryAddWithoutValidation("t", t);
        req.Headers.TryAddWithoutValidation("sign_method", "HMAC-SHA256");
        req.Headers.TryAddWithoutValidation("mode", "cors");
        if (accessToken != null)
            req.Headers.TryAddWithoutValidation("access_token", accessToken);
    }

    private static long NowMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    private static string Sha256Hex(string s)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(s ?? ""));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string HmacSha256UpperHex(string secret, string payload)
    {
        var bytes = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(bytes).ToLowerInvariant().ToUpperInvariant();
    }
}
