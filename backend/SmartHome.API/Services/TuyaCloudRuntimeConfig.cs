using Microsoft.Extensions.Options;

namespace SmartHome.API.Services;

/// <summary>
/// Рантайм-конфиг Tuya Cloud: стартует из appsettings/env и может обновляться из админ-экрана.
/// </summary>
public sealed class TuyaCloudRuntimeConfig
{
    private readonly object _sync = new();
    private bool _enabled;
    private string _accessId;
    private string _accessSecret;
    private string _region;

    public TuyaCloudRuntimeConfig(IOptions<TuyaCloudOptions> options)
    {
        var o = options.Value;
        _enabled = o.Enabled;
        _accessId = o.AccessId ?? string.Empty;
        _accessSecret = o.AccessSecret ?? string.Empty;
        _region = string.IsNullOrWhiteSpace(o.Region) ? "eu" : o.Region.Trim();
    }

    public TuyaCloudOptions Snapshot()
    {
        lock (_sync)
        {
            return new TuyaCloudOptions
            {
                Enabled = _enabled,
                AccessId = _accessId,
                AccessSecret = _accessSecret,
                Region = _region
            };
        }
    }

    public void Update(bool? enabled, string? accessId, string? accessSecret, string? region)
    {
        lock (_sync)
        {
            if (enabled.HasValue) _enabled = enabled.Value;
            if (accessId != null) _accessId = accessId.Trim();
            // Пустое / не передано — не трогаем сохранённый секрет (форма может оставить поле пустым по ошибке).
            if (!string.IsNullOrWhiteSpace(accessSecret)) _accessSecret = accessSecret.Trim();
            if (region != null)
            {
                var r = region.Trim();
                _region = string.IsNullOrWhiteSpace(r) ? "eu" : r;
            }
        }
    }
}
