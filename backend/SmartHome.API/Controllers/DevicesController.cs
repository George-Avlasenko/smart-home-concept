using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHome.API.DTOs;
using SmartHome.API.Models;
using SmartHome.API.Services;

namespace SmartHome.API.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize] // Требует токен для всех методов
public class DevicesController : ControllerBase
{
    private readonly SmartHomeContext _context;
    private readonly EventPublisher _eventPublisher;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly TuyaServiceLocator _tuyaServiceLocator;
    private readonly TuyaCloudLocalKeyService _tuyaCloudLocalKey;

    private static string? MapTuyaCategoryToType(string? categoryCode)
    {
        if (string.IsNullOrWhiteSpace(categoryCode)) return null;
        var c = categoryCode.Trim().ToLowerInvariant();
        if (c.Contains("light")) return "light";
        if (c is "dj" or "dd") return "light";
        if (c.Contains("vacuum")) return "vacuum";
        if (c is "sd" or "robot") return "vacuum";
        if (c.Contains("camera")) return "camera";
        if (c is "sp" or "ipc") return "camera";
        if (c.Contains("lock")) return "lock";
        if (c.Contains("switch")) return "switch";
        if (c.Contains("socket") || c.Contains("outlet")) return "outlet";
        if (c.Contains("kettle")) return "kettle";
        if (c.Contains("curtain")) return "curtain";
        if (c.Contains("sensor")) return "sensor";
        if (c.Contains("thermostat") || c.Contains("air")) return "thermostat";
        return null;
    }

    public DevicesController(
        SmartHomeContext context,
        EventPublisher eventPublisher,
        IHttpClientFactory httpClientFactory,
        TuyaServiceLocator tuyaServiceLocator,
        TuyaCloudLocalKeyService tuyaCloudLocalKey)
    {
        _context = context;
        _eventPublisher = eventPublisher;
        _httpClientFactory = httpClientFactory;
        _tuyaServiceLocator = tuyaServiceLocator;
        _tuyaCloudLocalKey = tuyaCloudLocalKey;
    }

    private static Dictionary<string, object> SettingsFromMeta(string? meta, Dictionary<string, object> fallback)
    {
        var parsed = DeviceMetaHelper.ParseToNestedObjects(meta);
        return parsed.Count > 0 ? parsed : fallback;
    }

    /// <summary>Держим settings.tuya.ip / deviceId в соответствии с колонками устройства (карточка читает IP из tuya).</summary>
    private static void SyncTuyaBlockWithDeviceRow(Device device)
    {
        if (string.IsNullOrWhiteSpace(device.MetaData)) return;
        var settings = DeviceMetaHelper.ParseToNestedObjects(device.MetaData);
        if (!settings.TryGetValue("tuya", out var tuyaRaw) || tuyaRaw is not Dictionary<string, object> tuya)
            return;
        tuya["ip"] = device.Ip?.ToString() ?? "";
        if (!string.IsNullOrWhiteSpace(device.HardwareDeviceId))
            tuya["deviceId"] = device.HardwareDeviceId;
        device.MetaData = JsonSerializer.Serialize(settings);
    }

    private static string? TryGetCatalogSku(string? meta)
    {
        if (string.IsNullOrEmpty(meta)) return null;
        try
        {
            using var doc = JsonDocument.Parse(meta);
            if (doc.RootElement.TryGetProperty("catalogSku", out var p))
                return p.GetString();
        }
        catch { /* ignore */ }
        return null;
    }

    private async Task<IPAddress> AllocateSyntheticIpAsync(CancellationToken ct)
    {
        var used = await _context.Devices
            .Where(d => d.Ip != null)
            .Select(d => d.Ip!.ToString())
            .ToListAsync(ct);
        var usedSet = used.Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Диапазон для виртуальных/эмулируемых устройств в LAN-подсети 192.168.x.x.
        for (var c = 1; c < 255; c++)
        {
            for (var d = 2; d < 255; d++)
            {
                var candidate = $"192.168.{c}.{d}";
                if (!usedSet.Contains(candidate))
                    return IPAddress.Parse(candidate);
            }
        }

        return IPAddress.Parse("192.168.254.254");
    }

    /// <summary>Подмешиваем вычисляемые возможности света для старых записей без lightCapabilities в MetaData.</summary>
    private static Dictionary<string, object> EnrichDerivedSettings(Dictionary<string, object> settings, string? productSku, string? type)
    {
        if (settings.TryGetValue("lightCapabilities", out var existing) && existing is Dictionary<string, object>)
        {
            // no-op, keep existing capabilities
        }

        var product = DeviceProductCatalog.TryGet(productSku);
        if (product == null) return settings;

        if (!settings.TryGetValue("productFeatures", out var pf) || pf is not IEnumerable<object>)
        {
            settings["productFeatures"] = product.Features?.ToArray() ?? Array.Empty<string>();
        }

        if (string.Equals(type, "light", StringComparison.OrdinalIgnoreCase)
            && (!settings.TryGetValue("lightCapabilities", out var lc) || lc is not Dictionary<string, object>))
        {
            settings["lightCapabilities"] = LightCapabilitiesHelper.FromCatalogFeatures(product.Features);
        }
        return settings;
    }

    /// <summary>
    /// Для Tuya-ламп отправляет реальную команду switch в tuya-service.
    /// Возвращает null при успехе, иначе текст ошибки.
    /// </summary>
    private async Task<string?> TrySendTuyaSwitchAsync(Device device, DeviceStatus targetStatus, CancellationToken ct)
    {
        if (!string.Equals(device.Type, "light", StringComparison.OrdinalIgnoreCase))
            return null;

        var settings = DeviceMetaHelper.ParseToNestedObjects(device.MetaData);
        Dictionary<string, object> tuyaDict;
        if (!settings.TryGetValue("tuya", out var tuyaRaw) || tuyaRaw is null)
        {
            tuyaDict = new Dictionary<string, object>
            {
                ["enabled"] = true,
                ["deviceId"] = device.HardwareDeviceId ?? "",
                ["ip"] = device.Ip?.ToString() ?? "",
                ["version"] = "3.5",
                ["dpsSwitch"] = 20
            };
            settings["tuya"] = tuyaDict;
            tuyaRaw = tuyaDict;
        }
        else if (tuyaRaw is Dictionary<string, object> parsedTuya)
        {
            tuyaDict = parsedTuya;
        }
        else
        {
            try
            {
                var reParsed = DeviceMetaHelper.ParseToNestedObjects(JsonSerializer.Serialize(tuyaRaw));
                tuyaDict = reParsed.Count > 0 ? reParsed : new Dictionary<string, object>();
                settings["tuya"] = tuyaDict;
                tuyaRaw = tuyaDict;
            }
            catch
            {
                tuyaDict = new Dictionary<string, object>();
                settings["tuya"] = tuyaDict;
                tuyaRaw = tuyaDict;
            }
        }

        try
        {
            var tuyaJson = JsonSerializer.Serialize(tuyaRaw);
            using var doc = JsonDocument.Parse(tuyaJson);
            var root = doc.RootElement;

            var enabled = root.TryGetProperty("enabled", out var en) &&
                          (en.ValueKind == JsonValueKind.True ||
                           (en.ValueKind == JsonValueKind.String && bool.TryParse(en.GetString(), out var b) && b));
            if (!enabled && (string.IsNullOrWhiteSpace(device.HardwareDeviceId) || device.Ip is null))
                return null;

            var deviceId = root.TryGetProperty("deviceId", out var d) ? d.GetString() : null;
            var localKey = root.TryGetProperty("localKey", out var k) ? k.GetString() : null;
            var ip = root.TryGetProperty("ip", out var i) ? i.GetString() : null;
            var version = root.TryGetProperty("version", out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString())
                ? v.GetString()!
                : "3.5";
            var dpsSwitch = 20;
            if (root.TryGetProperty("dpsSwitch", out var ds))
            {
                if (ds.ValueKind == JsonValueKind.Number && ds.TryGetInt32(out var n)) dpsSwitch = n;
                else if (ds.ValueKind == JsonValueKind.String && int.TryParse(ds.GetString(), out var s)) dpsSwitch = s;
            }

            // Фолбэки из колонок устройства для старых/неполных meta.
            deviceId = string.IsNullOrWhiteSpace(deviceId) ? device.HardwareDeviceId : deviceId;
            ip = string.IsNullOrWhiteSpace(ip) ? device.Ip?.ToString() : ip;
            if (!string.IsNullOrWhiteSpace(deviceId)) tuyaDict["deviceId"] = deviceId.Trim();
            if (!string.IsNullOrWhiteSpace(ip)) tuyaDict["ip"] = ip.Trim();
            if (!tuyaDict.TryGetValue("version", out var verObj) || string.IsNullOrWhiteSpace(verObj?.ToString()))
                tuyaDict["version"] = version;
            if (!tuyaDict.TryGetValue("dpsSwitch", out var dpsObj) || !int.TryParse(dpsObj?.ToString(), out var parsedDps) || parsedDps <= 0)
                tuyaDict["dpsSwitch"] = dpsSwitch > 0 ? dpsSwitch : 20;
            tuyaDict["enabled"] = true;

            // One-time recovery for old devices added before Tuya Cloud was configured.
            if (string.IsNullOrWhiteSpace(localKey) && !string.IsNullOrWhiteSpace(deviceId) && _tuyaCloudLocalKey.IsConfigured)
            {
                var fetched = await _tuyaCloudLocalKey.TryGetLocalKeyForDeviceAsync(deviceId.Trim(), ct);
                if (!string.IsNullOrWhiteSpace(fetched))
                {
                    localKey = fetched.Trim();
                    tuyaDict["localKey"] = localKey;
                    tuyaDict["enabled"] = true;
                    device.MetaData = JsonSerializer.Serialize(settings);
                    await _context.SaveChangesAsync(ct);
                }
            }

            if (string.IsNullOrWhiteSpace(deviceId) || string.IsNullOrWhiteSpace(localKey) || string.IsNullOrWhiteSpace(ip))
            {
                device.MetaData = JsonSerializer.Serialize(settings);
                await _context.SaveChangesAsync(ct);
                var missing = new List<string>();
                if (string.IsNullOrWhiteSpace(deviceId)) missing.Add("deviceId");
                if (string.IsNullOrWhiteSpace(localKey)) missing.Add("localKey");
                if (string.IsNullOrWhiteSpace(ip)) missing.Add("ip");
                var tail = string.IsNullOrWhiteSpace(localKey) && !_tuyaCloudLocalKey.IsConfigured
                    ? " Tuya Cloud не настроен: заполните в Админ → Интеграции или нажмите «Обновить local key» на /labs/tuya."
                    : string.Empty;
                return $"Для Tuya-команды отсутствуют: {string.Join(", ", missing)}.{tail}";
            }

            var baseUrl = await _tuyaServiceLocator.GetReachableBaseUrlAsync(ct);
            if (string.IsNullOrEmpty(baseUrl))
                return "tuya-service недоступен (порт 5055, /health).";

            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(8);
            using var res = await client.PostAsJsonAsync(
                $"{baseUrl.TrimEnd('/')}/v1/switch",
                new
                {
                    device_id = deviceId.Trim(),
                    local_key = localKey,
                    ip = ip.Trim(),
                    version,
                    dps_switch = dpsSwitch > 0 ? dpsSwitch : 20,
                    on = targetStatus == DeviceStatus.active
                },
                ct);

            if (res.IsSuccessStatusCode) return null;
            var body = await res.Content.ReadAsStringAsync(ct);
            return $"tuya-service {(int)res.StatusCode}: {body}";
        }
        catch (Exception ex)
        {
            return ex.Message;
        }
    }

    /// <summary>Каталог моделей, разрешённых для добавления в систему.</summary>
    [HttpGet("catalog")]
    public ActionResult<IEnumerable<SupportedDeviceProductDto>> GetProductCatalog()
    {
        var list = DeviceProductCatalog.All.Select(p => new SupportedDeviceProductDto
        {
            Sku = p.Sku,
            DisplayName = p.DisplayName,
            Manufacturer = p.Manufacturer,
            Type = p.Type,
            SuggestedName = p.SuggestedName,
            Category = p.Category,
            Features = p.Features?.ToList() ?? [],
            TuyaProductLabel = p.TuyaProductLabel
        });
        return Ok(list);
    }

    /// <summary>Запрос на добавление новой модели в каталог.</summary>
    [HttpPost("catalog-requests")]
    public ActionResult SubmitCatalogRequest([FromBody] DeviceCatalogRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Category) ||
            string.IsNullOrWhiteSpace(dto.DeviceKind) ||
            string.IsNullOrWhiteSpace(dto.Connectivity) ||
            string.IsNullOrWhiteSpace(dto.Contact))
        {
            return BadRequest("Заполните обязательные поля заявки.");
        }

        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        var userId = claim?.Value;

        Console.WriteLine($"[CatalogRequest] user={userId ?? "unknown"}; " +
            $"category={dto.Category.Trim()}; kind={dto.DeviceKind.Trim()}; " +
            $"connectivity={dto.Connectivity.Trim()}; lightMode={dto.LightMode?.Trim() ?? "-"}; " +
            $"contact={dto.Contact.Trim()}; comment={dto.Comment?.Trim() ?? "-"}");

        return Ok(new { message = "Заявка отправлена разработчику" });
    }

    /// <summary>Автопоиск устройств в локальной сети (через tuya-service).</summary>
    [HttpPost("discover")]
    public async Task<ActionResult> DiscoverDevices([FromBody] DiscoverDeviceDto dto)
    {
        var mode = string.IsNullOrWhiteSpace(dto.Mode) ? "auto" : dto.Mode.Trim();
        if (!string.Equals(mode, "auto", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(mode, "tuya_lan", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Поддерживаются режимы auto и tuya_lan", mode });
        }

        var timeout = dto.TimeoutSec ?? (string.Equals(mode, "tuya_lan", StringComparison.OrdinalIgnoreCase) ? 30 : 28);
        timeout = Math.Clamp(timeout, 5, 120);
        var want = dto.WantIps?
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s.Trim())
            .ToList();
        if (want is { Count: 0 })
            want = null;

        var body = new Dictionary<string, object> { ["mode"] = mode.ToLowerInvariant(), ["timeout_sec"] = timeout };
        if (want != null)
            body["want_ips"] = want;

        var baseUrl = await _tuyaServiceLocator.GetReachableBaseUrlAsync(HttpContext.RequestAborted);
        if (string.IsNullOrEmpty(baseUrl))
        {
            _tuyaServiceLocator.InvalidateCache();
            baseUrl = await _tuyaServiceLocator.GetReachableBaseUrlAsync(HttpContext.RequestAborted);
        }

        if (string.IsNullOrEmpty(baseUrl))
        {
            return StatusCode(502, new
            {
                message = "Сервис поиска недоступен: с хоста backend не открывается tuya-service на порту 5055 (/health). Проверьте контейнер smarthome_tuya и network_mode: host.",
            });
        }

        try
        {
            var http = _httpClientFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(string.Equals(mode, "tuya_lan", StringComparison.OrdinalIgnoreCase) ? 95 : 90);
            var discoverPath = $"{baseUrl}/v1/discover";

            JsonElement payload;
            if (want == null)
            {
                // Сканируем короткими окнами: быстро отдаём результат, но собираем НЕ одно, а несколько устройств.
                var started = DateTime.UtcNow;
                var seen = new Dictionary<string, JsonNode>(StringComparer.OrdinalIgnoreCase);
                payload = JsonSerializer.Deserialize<JsonElement>("{\"ok\":true,\"count\":0,\"devices\":[]}");
                var stableRounds = 0;
                while (true)
                {
                    var elapsed = (int)(DateTime.UtcNow - started).TotalSeconds;
                    var remaining = Math.Max(0, timeout - elapsed);
                    var chunk = Math.Clamp(remaining, 1, 5);

                    using var chunkRes = await http.GetAsync($"{discoverPath}?timeout_sec={chunk}", HttpContext.RequestAborted);
                    if (!chunkRes.IsSuccessStatusCode)
                    {
                        var txt = await chunkRes.Content.ReadAsStringAsync(HttpContext.RequestAborted);
                        if (chunkRes.StatusCode is System.Net.HttpStatusCode.BadRequest ||
                            chunkRes.StatusCode is System.Net.HttpStatusCode.ServiceUnavailable)
                            return StatusCode((int)chunkRes.StatusCode, txt);
                        return StatusCode(502, new { message = "Ошибка ответа tuya-service при поиске", detail = txt[..Math.Min(400, txt.Length)] });
                    }

                    var chunkPayload = await chunkRes.Content.ReadFromJsonAsync<JsonElement>(HttpContext.RequestAborted);
                    if (chunkPayload.ValueKind != JsonValueKind.Undefined &&
                        chunkPayload.TryGetProperty("devices", out var arr) &&
                        arr.ValueKind == JsonValueKind.Array)
                    {
                        var root = JsonNode.Parse(chunkPayload.GetRawText());
                        var nodes = root?["devices"] as JsonArray;
                        var before = seen.Count;
                        if (nodes is not null)
                        {
                            foreach (var n in nodes)
                            {
                                if (n is not JsonObject obj) continue;
                                var did = obj["device_id"]?.GetValue<string>()?.Trim() ?? "";
                                var ip = obj["ip"]?.GetValue<string>()?.Trim() ?? "";
                                var key = $"{did}|{ip}";
                                if (key == "|") continue;
                                seen[key] = obj.DeepClone();
                            }
                        }
                        stableRounds = seen.Count == before ? stableRounds + 1 : 0;
                    }

                    // Завершаем, если время вышло или уже нашли устройства и два окна подряд нет новых.
                    if (remaining <= chunk || (seen.Count > 0 && stableRounds >= 2))
                        break;
                }

                var outDevices = new JsonArray();
                foreach (var item in seen.Values)
                    outDevices.Add(item);
                var outRoot = new JsonObject
                {
                    ["ok"] = true,
                    ["count"] = seen.Count,
                    ["devices"] = outDevices,
                    ["mode"] = mode,
                };
                payload = JsonSerializer.Deserialize<JsonElement>(outRoot.ToJsonString());
            }
            else
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, discoverPath)
                {
                    Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
                };
                using var res = await http.SendAsync(req, HttpContext.RequestAborted);
                if (!res.IsSuccessStatusCode)
                {
                    var txt = await res.Content.ReadAsStringAsync(HttpContext.RequestAborted);
                    if (res.StatusCode is System.Net.HttpStatusCode.BadRequest ||
                        res.StatusCode is System.Net.HttpStatusCode.ServiceUnavailable)
                        return StatusCode((int)res.StatusCode, txt);
                    return StatusCode(502, new { message = "Ошибка ответа tuya-service при поиске", detail = txt[..Math.Min(400, txt.Length)] });
                }
                payload = await res.Content.ReadFromJsonAsync<JsonElement>(HttpContext.RequestAborted);
                if (payload.ValueKind == JsonValueKind.Undefined)
                    return Ok(new { ok = true, count = 0, devices = Array.Empty<object>(), mode });
            }

            if (_tuyaCloudLocalKey.IsConfigured &&
                payload.TryGetProperty("devices", out var devicesArr) &&
                devicesArr.ValueKind == JsonValueKind.Array)
            {
                var root = JsonNode.Parse(payload.GetRawText());
                JsonArray? arr = root?["devices"] as JsonArray;
                if (arr is not null)
                {
                    foreach (var node in arr)
                    {
                        if (node is null) continue;
                        var did = node["device_id"]?.GetValue<string>()?.Trim();
                        if (string.IsNullOrWhiteSpace(did)) continue;

                        var profile = await _tuyaCloudLocalKey.TryGetDeviceProfileAsync(did, HttpContext.RequestAborted);
                        if (profile is null) continue;

                        if (!string.IsNullOrWhiteSpace(profile.ProductName))
                            node["cloud_product_name"] = profile.ProductName;

                        var matched = DeviceProductCatalog.TryMatchTuyaCloud(profile.ProductId, profile.ProductName);
                        if (matched is not null)
                        {
                            node["matched_catalog_sku"] = matched.Sku;
                            node["matched_catalog_label"] = matched.TuyaProductLabel ?? matched.DisplayName;
                        }
                    }
                }

                return Ok(JsonSerializer.Deserialize<JsonElement>(root!.ToJsonString()));
            }

            return Ok(payload);
        }
        catch (Exception ex)
        {
            _tuyaServiceLocator.InvalidateCache();
            return StatusCode(502, new { message = "Не удалось выполнить поиск в сети через tuya-service", detail = ex.Message });
        }
    }

    // GET: api/devices
    [HttpGet]
    public async Task<ActionResult<IEnumerable<DeviceDto>>> GetDevices()
    {
        try
        {
            var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim == null) return Unauthorized("Missing userId claim");
            var userId = int.Parse(claim.Value);
            
            var roleClaim = User.FindFirst(ClaimTypes.Role);
            var userRole = roleClaim?.Value ?? "user";

            IQueryable<Device> query = _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House); // Подгружаем Дом для группировки

        // Если не админ, фильтруем по правам доступа
        if (userRole != "admin")
        {
            // Получаем список домов, где пользователь владелец ИЛИ совладелец (admin)
            var ownedHouseIds = await _context.Houses
               .Where(h => h.OwnerId == userId)
               .Select(h => h.HouseId)
               .ToListAsync();

            var coOwnedHouseIds = await _context.HouseUsers
               .Where(hu => hu.UserId == userId && hu.Role == "admin")
               .Select(hu => hu.HouseId)
               .ToListAsync();
            
            var fullAccessHouseIds = ownedHouseIds.Concat(coOwnedHouseIds).Distinct().ToList();

            query = query.Where(d => 
                d.UserDevicePermissions.Any(p => p.UserId == userId) ||
                fullAccessHouseIds.Contains(d.Room.HouseId)
            );
        }

        var devices = await query
            .Include(d => d.UserDevicePermissions) // Нужно подгрузить разрешения
            .ToListAsync();

        // Кэшируем список домов, где пользователь совладелец, чтобы не делать запросы в цикле
        var userCoOwnedHouses = await _context.HouseUsers
            .Where(hu => hu.UserId == userId && hu.Role == "admin")
            .Select(hu => hu.HouseId)
            .ToListAsync();

        var dtos = devices.Select(d => {
            var productSku = TryGetCatalogSku(d.MetaData);
            var settings = EnrichDerivedSettings(DeviceMetaHelper.ParseToNestedObjects(d.MetaData), productSku, d.Type);

            // Определяем права текущего пользователя
            string permission = "viewer";
            
            // Проверка на полного админа (владелец или совладелец дома)
            bool isFullAdmin = userRole == "admin" || 
                               d.Room.House.OwnerId == userId || 
                               userCoOwnedHouses.Contains(d.Room.HouseId);

            if (isFullAdmin)
            {
                permission = "admin"; // Владелец/Совладелец = Админ устройства
            }
            else
            {
                // Ищем явное разрешение для этого пользователя
                var userPerm = d.UserDevicePermissions.FirstOrDefault(p => p.UserId == userId);
                if (userPerm != null)
                {
                    permission = userPerm.PermissionLevel.ToString().ToLower();
                }
            }

            return new DeviceDto
        {
            DeviceId = d.DeviceId,
            RoomId = d.RoomId,
            RoomName = d.Room.RoomName,
                HouseId = d.Room.HouseId,
                HouseAddress = d.Room.House.Address,
            Name = d.Name,
            Manufacturer = d.Manufacturer,
                ProductSku = productSku,
                HardwareDeviceId = d.HardwareDeviceId,
            Type = d.Type,
            Ip = d.Ip != null ? d.Ip.ToString() : null,
                MacAddress = d.MacAddress,
                Status = d.Status.ToString(),
                Settings = settings,
                CurrentUserPermission = permission,
                OutdoorTemp = d.Room?.House?.OutdoorTemp,
                OutdoorHumidity = d.Room?.House?.OutdoorHumidity,
                OutdoorCo2 = d.Room?.House?.OutdoorCo2
            };
        }).ToList();

        return Ok(dtos);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] GetDevices failed: {ex}");
            return StatusCode(500, $"Error getting devices: {ex.Message}");
        }
    }

    // PUT: api/devices/5/settings
    [HttpPut("{id}/settings")]
    public async Task<IActionResult> UpdateDeviceSettings(int id, [FromBody] UpdateDeviceSettingsDto dto)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "user";

        var device = await _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House)
            .Include(d => d.UserDevicePermissions)
            .FirstOrDefaultAsync(d => d.DeviceId == id);

        if (device == null) return NotFound();

        // Проверка прав (нужен user или admin)
        if (userRole != "admin")
        {
            // Проверка владельца дома или совладельца
            bool isOwnerOrCoOwner = device.Room.House.OwnerId == userId || 
                                    await _context.HouseUsers.AnyAsync(hu => hu.HouseId == device.Room.HouseId && hu.UserId == userId && hu.Role == "admin");

            if (!isOwnerOrCoOwner)
            {
                var permission = device.UserDevicePermissions.FirstOrDefault(p => p.UserId == userId);
                if (permission == null || permission.PermissionLevel == PermissionLevel.viewer)
                {
                    return Forbid("Нет прав на изменение настроек.");
                }
            }
        }

        // Обновляем MetaData
        var currentSettings = DeviceMetaHelper.ParseToNestedObjects(device.MetaData);

        foreach (var kvp in dto.Settings)
        {
            currentSettings[kvp.Key] = kvp.Value;
        }

        device.MetaData = JsonSerializer.Serialize(currentSettings);
        await _context.SaveChangesAsync();

        // Публикуем событие обновления настроек устройства
        await _eventPublisher.PublishAsync("device.settings.updated", new
        {
            deviceId = device.DeviceId,
            settings = currentSettings,
            changedBy = userId
        });

        return Ok(currentSettings);
    }

    // POST: api/devices/5/tuya/refresh-local-key
    [HttpPost("{id:int}/tuya/refresh-local-key")]
    public async Task<IActionResult> RefreshTuyaLocalKey(int id)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "user";

        var device = await _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House)
            .Include(d => d.UserDevicePermissions)
            .FirstOrDefaultAsync(d => d.DeviceId == id);
        if (device == null) return NotFound("Устройство не найдено.");

        if (userRole != "admin")
        {
            var isOwnerOrCoOwner = device.Room.House.OwnerId == userId ||
                                   await _context.HouseUsers.AnyAsync(hu => hu.HouseId == device.Room.HouseId && hu.UserId == userId && hu.Role == "admin");
            if (!isOwnerOrCoOwner)
            {
                var permission = device.UserDevicePermissions.FirstOrDefault(p => p.UserId == userId);
                if (permission == null || permission.PermissionLevel == PermissionLevel.viewer)
                    return Forbid("Нет прав на изменение настроек устройства.");
            }
        }

        if (!_tuyaCloudLocalKey.IsConfigured)
            return BadRequest(new { message = "Tuya Cloud не настроен на сервере (TUYA_CLOUD_*)." });

        var hardwareId = device.HardwareDeviceId?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(hardwareId))
            return BadRequest(new { message = "У устройства не задан Device ID (hardwareDeviceId)." });

        var lk = await _tuyaCloudLocalKey.TryGetLocalKeyForDeviceAsync(hardwareId, HttpContext.RequestAborted);
        if (string.IsNullOrWhiteSpace(lk))
            return StatusCode(502, new { message = "Не удалось получить local key из Tuya Cloud для этого Device ID." });

        var settings = DeviceMetaHelper.ParseToNestedObjects(device.MetaData);
        if (!settings.TryGetValue("tuya", out var tuyaRaw) || tuyaRaw is not Dictionary<string, object> tuya)
        {
            tuya = new Dictionary<string, object>();
            settings["tuya"] = tuya;
        }

        tuya["enabled"] = true;
        tuya["deviceId"] = hardwareId;
        tuya["localKey"] = lk;
        tuya["ip"] = device.Ip?.ToString() ?? (tuya.TryGetValue("ip", out var ipObj) ? ipObj?.ToString() ?? "" : "");
        if (!tuya.TryGetValue("version", out var verObj) || string.IsNullOrWhiteSpace(verObj?.ToString()))
            tuya["version"] = "3.5";
        if (!tuya.TryGetValue("dpsSwitch", out var dpsObj) || !int.TryParse(dpsObj?.ToString(), out var dps) || dps <= 0)
            tuya["dpsSwitch"] = 20;

        device.MetaData = JsonSerializer.Serialize(settings);
        await _context.SaveChangesAsync();

        await _eventPublisher.PublishAsync("device.updated", new
        {
            deviceId = device.DeviceId,
            hardwareDeviceId = device.HardwareDeviceId,
            type = device.Type,
            changedBy = userId
        });

        return Ok(new { ok = true, localKey = lk });
    }

    // POST: api/devices/tuya/refresh-local-key (по Tuya Device ID, для /labs/tuya)
    [HttpPost("tuya/refresh-local-key")]
    public async Task<IActionResult> RefreshTuyaLocalKeyByHardwareId([FromBody] RefreshTuyaLocalKeyDto dto)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var hardwareId = dto.HardwareDeviceId?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(hardwareId))
            return BadRequest(new { message = "Укажите Device ID." });

        if (!_tuyaCloudLocalKey.IsConfigured)
            return BadRequest(new { message = "Tuya Cloud не настроен на сервере (TUYA_CLOUD_*)." });

        var lk = await _tuyaCloudLocalKey.TryGetLocalKeyForDeviceAsync(hardwareId, HttpContext.RequestAborted);
        if (string.IsNullOrWhiteSpace(lk))
            return StatusCode(502, new { message = "Не удалось получить local key из Tuya Cloud для этого Device ID." });

        return Ok(new { ok = true, localKey = lk });
    }

    // GET: api/devices/5
    [HttpGet("{id}")]
    public async Task<ActionResult<DeviceDto>> GetDevice(int id)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "user";

        var device = await _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House)
            .Include(d => d.UserDevicePermissions)
            .FirstOrDefaultAsync(d => d.DeviceId == id);

        if (device == null)
        {
            return NotFound();
        }

        // Проверка прав доступа
        if (userRole != "admin")
        {
             bool isOwnerOrCoOwner = device.Room.House.OwnerId == userId || 
                                     await _context.HouseUsers.AnyAsync(hu => hu.HouseId == device.Room.HouseId && hu.UserId == userId && hu.Role == "admin");
             
             if (!isOwnerOrCoOwner && !device.UserDevicePermissions.Any(p => p.UserId == userId))
        {
                 return Forbid();
             }
        }

        var productSkuSingle = TryGetCatalogSku(device.MetaData);
        var settings = EnrichDerivedSettings(DeviceMetaHelper.ParseToNestedObjects(device.MetaData), productSkuSingle, device.Type);

        // Определяем права текущего пользователя
        string permission = "viewer";
        bool isFullAdmin = userRole == "admin" || 
                           device.Room.House.OwnerId == userId || 
                           await _context.HouseUsers.AnyAsync(hu => hu.HouseId == device.Room.HouseId && hu.UserId == userId && hu.Role == "admin");

        if (isFullAdmin)
        {
            permission = "admin";
        }
        else
        {
            var userPerm = device.UserDevicePermissions.FirstOrDefault(p => p.UserId == userId);
            if (userPerm != null)
            {
                permission = userPerm.PermissionLevel.ToString().ToLower();
            }
        }

        return new DeviceDto
        {
            DeviceId = device.DeviceId,
            RoomId = device.RoomId,
            RoomName = device.Room.RoomName,
            HouseId = device.Room.HouseId,
            HouseAddress = device.Room.House.Address,
            Name = device.Name,
            Manufacturer = device.Manufacturer,
            ProductSku = productSkuSingle,
            HardwareDeviceId = device.HardwareDeviceId,
            Type = device.Type,
            Ip = device.Ip != null ? device.Ip.ToString() : null,
            MacAddress = device.MacAddress,
            Status = device.Status.ToString(),
            Settings = settings,
            CurrentUserPermission = permission,
            OutdoorTemp = device.Room?.House?.OutdoorTemp,
            OutdoorHumidity = device.Room?.House?.OutdoorHumidity,
            OutdoorCo2 = device.Room?.House?.OutdoorCo2
        };
    }

    // POST: api/devices
    [HttpPost]
    public async Task<ActionResult<Device>> CreateDevice(CreateDeviceDto dto)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "user";

        // Проверка существования комнаты с подгрузкой дома
        var room = await _context.Rooms
            .Include(r => r.House)
            .FirstOrDefaultAsync(r => r.RoomId == dto.RoomId);

        if (room == null)
        {
            return BadRequest("Указанная комната не существует.");
        }

        // Проверка прав: Админ, Владелец дома или Совладелец
        bool isCoOwner = await _context.HouseUsers.AnyAsync(hu => hu.HouseId == room.HouseId && hu.UserId == userId && hu.Role == "admin");
        
        if (userRole != "admin" && room.House.OwnerId != userId && !isCoOwner)
        {
            return Problem(
                statusCode: 400,
                title: "Ошибка доступа",
                detail: "Вы не являетесь владельцем или совладельцем этого дома."
            );
        }

        var product = DeviceProductCatalog.TryGet(dto.ProductSku);
        if (product == null)
            return BadRequest($"Неизвестная модель устройства (SKU): {dto.ProductSku}.");

        var hardwareId = dto.HardwareDeviceId?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(hardwareId))
            return BadRequest("Укажите идентификатор устройства (Device ID).");

        if (await _context.Devices.AnyAsync(d => d.HardwareDeviceId == hardwareId))
            return BadRequest($"Устройство с таким идентификатором уже зарегистрировано: {hardwareId}");

        // Жесткая валидация для Tuya: нельзя добавить лампу как пылесос и т.п.
        if (_tuyaCloudLocalKey.IsConfigured)
        {
            var profile = await _tuyaCloudLocalKey.TryGetDeviceProfileAsync(hardwareId, HttpContext.RequestAborted);
            if (profile != null)
            {
                var matchedByCloud = DeviceProductCatalog.TryMatchTuyaCloud(profile.ProductId, profile.ProductName);
                if (matchedByCloud == null)
                {
                    return BadRequest(new
                    {
                        message = "Такого девайса нет в каталоге поиска.",
                        detail = $"Устройство из Tuya Cloud: product_id='{profile.ProductId ?? "-"}', product_name='{profile.ProductName ?? "-"}'. Оставьте форму — разработчик постарается помочь в кратчайшие сроки."
                    });
                }
                if (!string.Equals(matchedByCloud.Sku, product.Sku, StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new
                    {
                        message = "Выбрана неверная модель для найденного устройства.",
                        detail = $"По Tuya Cloud устройство определено как '{matchedByCloud.DisplayName}' (SKU: {matchedByCloud.Sku}), а выбрана '{product.DisplayName}' (SKU: {product.Sku})."
                    });
                }

                var actualType = MapTuyaCategoryToType(profile.CategoryCode);
                if (!string.IsNullOrWhiteSpace(actualType) &&
                    !string.Equals(actualType, product.Type, StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new
                    {
                        message = "Тип выбранной модели не совпадает с реальным типом устройства Tuya.",
                        detail = $"Устройство '{profile.ProductName ?? hardwareId}' (category: {profile.CategoryCode ?? "unknown"}) определено как '{actualType}', а выбрана модель типа '{product.Type}'. Выберите корректную модель."
                    });
                }
            }
        }

        IPAddress? ipAddress = null;
        // Проверка на дубликаты по IP
        if (!string.IsNullOrWhiteSpace(dto.Ip))
        {
            try 
            {
                ipAddress = IPAddress.Parse(dto.Ip);
                var existing = await _context.Devices.FirstOrDefaultAsync(d => d.Ip == ipAddress);
                if (existing != null)
                {
                     return BadRequest($"Устройство с IP {dto.Ip} уже существует.");
                }
            }
            catch (FormatException)
            {
                return BadRequest($"Неверный формат IP адреса: {dto.Ip}. Ожидается формат xxx.xxx.xxx.xxx (например: 192.168.1.1)");
            }
        }
        else
        {
            ipAddress = await AllocateSyntheticIpAsync(HttpContext.RequestAborted);
        }

        var metaDict = new Dictionary<string, object> { ["catalogSku"] = product.Sku };
        if (string.Equals(product.Type, "light", StringComparison.OrdinalIgnoreCase))
            metaDict["lightCapabilities"] = LightCapabilitiesHelper.FromCatalogFeatures(product.Features);

        try
        {
        var device = new Device
        {
            RoomId = dto.RoomId,
            Name = dto.Name.Trim(),
            Manufacturer = product.Manufacturer,
            HardwareDeviceId = hardwareId,
            Type = product.Type,
            Status = DeviceStatus.inactive,
                Ip = ipAddress,
                MetaData = JsonSerializer.Serialize(metaDict),
                CreatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified)
        };

        _context.Devices.Add(device);
        await _context.SaveChangesAsync();

            // Права владельцу уже не обязательны через таблицу, так как мы проверяем OwnerId,
            // но можно добавить для порядка или удалить этот блок, если мы полностью перешли на логику "Владелец видит все".
            // Лучше не добавлять лишних записей, если логика работает через House.OwnerId
            // Но добавим, чтобы старый код (если где-то остался) работал.
            
            var permission = new UserDevicePermission
            {
                UserId = userId,
                DeviceId = device.DeviceId,
                PermissionLevel = PermissionLevel.admin,
                GrantedBy = userId
            };
            _context.UserDevicePermissions.Add(permission);
            await _context.SaveChangesAsync();

            // Local key из облака не зависит от IP; IP с поиска может отсутствовать — тогда пользователь дописывает в карточке дома.
            if (_tuyaCloudLocalKey.IsConfigured &&
                string.Equals(product.Manufacturer, "Tuya", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(product.Type, "light", StringComparison.OrdinalIgnoreCase))
            {
                var lk = await _tuyaCloudLocalKey.TryGetLocalKeyForDeviceAsync(hardwareId, HttpContext.RequestAborted);
                if (!string.IsNullOrWhiteSpace(lk))
                {
                    var ver = string.IsNullOrWhiteSpace(dto.TuyaLanVersion)
                        ? "3.5"
                        : dto.TuyaLanVersion.Trim();
                    var ipVal = dto.Ip?.Trim() ?? "";
                    metaDict["tuya"] = new Dictionary<string, object>
                    {
                        ["enabled"] = true,
                        ["deviceId"] = hardwareId,
                        ["localKey"] = lk,
                        ["ip"] = ipVal,
                        ["version"] = ver,
                        ["dpsSwitch"] = 20,
                    };
                    device.MetaData = JsonSerializer.Serialize(metaDict);
                    await _context.SaveChangesAsync();
                }
            }

            // Публикуем событие создания устройства
            await _eventPublisher.PublishAsync("device.created", new
            {
                deviceId = device.DeviceId,
                roomId = device.RoomId,
                name = device.Name,
                type = device.Type
            });

            return CreatedAtAction(nameof(GetDevice), new { id = device.DeviceId }, new DeviceDto
            {
                DeviceId = device.DeviceId,
                RoomId = device.RoomId,
                RoomName = room.RoomName,
                HouseId = room.HouseId,
                HouseAddress = room.House?.Address ?? "",
                Name = device.Name,
                Manufacturer = device.Manufacturer,
                ProductSku = product.Sku,
                HardwareDeviceId = device.HardwareDeviceId,
                Type = device.Type,
                Ip = device.Ip?.ToString(),
                MacAddress = device.MacAddress,
                Status = device.Status.ToString(),
                Settings = SettingsFromMeta(device.MetaData, metaDict),
                CurrentUserPermission = "admin",
                OutdoorTemp = room.House?.OutdoorTemp,
                OutdoorHumidity = room.House?.OutdoorHumidity,
                OutdoorCo2 = room.House?.OutdoorCo2
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Ошибка при создании устройства", error = ex.Message });
        }
    }

    // PUT: api/devices/5/status
    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateDeviceStatus(int id, UpdateDeviceStatusDto dto)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "user";

        var device = await _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House) // Обязательно подгружаем дом!
            .Include(d => d.UserDevicePermissions)
            .FirstOrDefaultAsync(d => d.DeviceId == id);

        if (device == null)
        {
            return NotFound();
        }

        if (userRole != "admin")
        {
            bool isOwnerOrCoOwner = device.Room.House.OwnerId == userId || 
                                    await _context.HouseUsers.AnyAsync(hu => hu.HouseId == device.Room.HouseId && hu.UserId == userId && hu.Role == "admin");

            if (!isOwnerOrCoOwner)
        {
            var permission = device.UserDevicePermissions.FirstOrDefault(p => p.UserId == userId);
            
            if (permission == null)
            {
                return Forbid("Нет доступа к устройству.");
            }

            if (permission.PermissionLevel == PermissionLevel.viewer)
            {
                return Forbid("У вас только права на просмотр.");
            }
        }
        }

        if (Enum.TryParse<DeviceStatus>(dto.Status, true, out var newStatus))
        {
            if (!dto.SkipTuyaLan)
            {
                var tuyaErr = await TrySendTuyaSwitchAsync(device, newStatus, HttpContext.RequestAborted);
                if (!string.IsNullOrWhiteSpace(tuyaErr))
                {
                    return StatusCode(502, new
                    {
                        message = "Команда в Tuya не отправлена",
                        detail = tuyaErr
                    });
                }
            }

            device.Status = newStatus;
            
            // Записываем событие изменения статуса
            var history = new DeviceStatusHistory
            {
                DeviceId = device.DeviceId,
                Status = newStatus,
                Timestamp = DateTime.UtcNow,
                ChangedByUserId = userId,
                ChangeReason = "manual"
            };
            _context.DeviceStatusHistories.Add(history);
        await _context.SaveChangesAsync();

            // Публикуем событие изменения статуса устройства
            Console.WriteLine($"[DevicesController] Publishing device.status.updated event for device {device.DeviceId}, status: {newStatus}");
            await _eventPublisher.PublishAsync("device.status.updated", new
            {
                deviceId = device.DeviceId,
                status = newStatus.ToString(),
                changedBy = userId
            });
            Console.WriteLine($"[DevicesController] Event published successfully");
        }
        else
        {
            return BadRequest($"Неверный статус устройства: {dto.Status}");
        }

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteDevice(int id)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "user";

        var device = await _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House)
            .FirstOrDefaultAsync(d => d.DeviceId == id);

        if (device == null)
        {
            return NotFound();
        }

        // Админ, Владелец или Совладелец
        bool isCoOwner = await _context.HouseUsers.AnyAsync(hu => hu.HouseId == device.Room.HouseId && hu.UserId == userId && hu.Role == "admin");

        if (userRole != "admin" && device.Room.House.OwnerId != userId && !isCoOwner)
        {
            return StatusCode(403, "Только владелец или совладелец может удалять устройства.");
        }

        var deviceId = device.DeviceId;
        _context.Devices.Remove(device);
        await _context.SaveChangesAsync();

        // Публикуем событие удаления устройства
        await _eventPublisher.PublishAsync("device.deleted", new
        {
            deviceId = deviceId
        });

        return NoContent();
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateDevice(int id, [FromBody] UpdateDeviceDto dto)
    {
        var claim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null) return Unauthorized();
        var userId = int.Parse(claim.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "user";

        var device = await _context.Devices
            .Include(d => d.Room)
            .ThenInclude(r => r.House)
            .FirstOrDefaultAsync(d => d.DeviceId == id);

        if (device == null) return NotFound();

        // Админ, Владелец или Совладелец
        bool isCoOwner = await _context.HouseUsers.AnyAsync(hu => hu.HouseId == device.Room.HouseId && hu.UserId == userId && hu.Role == "admin");

        if (userRole != "admin" && device.Room.House.OwnerId != userId && !isCoOwner)
        {
            return StatusCode(403, "Только владелец или совладелец может изменять устройства.");
        }

        // Проверка дубликатов и валидация IP
        if (dto.Ip != null && dto.Ip != device.Ip?.ToString())
        {
             if (!string.IsNullOrWhiteSpace(dto.Ip))
             {
                 try {
                    var ipAddr = IPAddress.Parse(dto.Ip);
                    if (await _context.Devices.AnyAsync(d => d.Ip == ipAddr && d.DeviceId != id))
                        return BadRequest($"Устройство с IP {dto.Ip} уже существует.");
                 } catch (FormatException) {
                    return BadRequest($"Неверный формат IP адреса: {dto.Ip}. Ожидается формат xxx.xxx.xxx.xxx (например: 192.168.1.1)");
                 }
             }
        }
        if (dto.HardwareDeviceId != null)
        {
            var hid = dto.HardwareDeviceId.Trim();
            if (hid != device.HardwareDeviceId &&
                await _context.Devices.AnyAsync(d => d.HardwareDeviceId == hid && d.DeviceId != id))
                return BadRequest($"Устройство с идентификатором {hid} уже существует.");
        }

        // Обновляем поля (модель из каталога не меняется — только имя в доме, ID экземпляра, IP)
        if (dto.Name != null) device.Name = dto.Name.Trim();
        if (dto.HardwareDeviceId != null)
            device.HardwareDeviceId = string.IsNullOrWhiteSpace(dto.HardwareDeviceId) ? null : dto.HardwareDeviceId.Trim();
        if (dto.Ip != null) {
             if (string.IsNullOrWhiteSpace(dto.Ip))
             {
                 device.Ip = null;
             }
             else
             {
                 try 
                 { 
                     device.Ip = IPAddress.Parse(dto.Ip);
                 } 
                 catch (FormatException)
                 {
                     return BadRequest($"Неверный формат IP адреса: {dto.Ip}. Ожидается формат xxx.xxx.xxx.xxx (например: 192.168.1.1)");
                 }
             }
        }

        SyncTuyaBlockWithDeviceRow(device);

        await _context.SaveChangesAsync();

        // Публикуем событие обновления устройства
        await _eventPublisher.PublishAsync("device.updated", new
        {
            deviceId = device.DeviceId,
            name = device.Name,
            type = device.Type,
            manufacturer = device.Manufacturer,
            hardwareDeviceId = device.HardwareDeviceId,
            productSku = TryGetCatalogSku(device.MetaData),
            ip = device.Ip?.ToString()
        });

        var productSkuUpdated = TryGetCatalogSku(device.MetaData);
        var settings = EnrichDerivedSettings(DeviceMetaHelper.ParseToNestedObjects(device.MetaData), productSkuUpdated, device.Type);
        return Ok(new DeviceDto
        {
            DeviceId = device.DeviceId,
            RoomId = device.RoomId,
            RoomName = device.Room.RoomName,
            HouseId = device.Room.HouseId,
            HouseAddress = device.Room.House.Address,
            Name = device.Name,
            Manufacturer = device.Manufacturer,
            ProductSku = productSkuUpdated,
            HardwareDeviceId = device.HardwareDeviceId,
            Type = device.Type,
            Ip = device.Ip?.ToString(),
            MacAddress = device.MacAddress,
            Status = device.Status.ToString(),
            Settings = settings,
            CurrentUserPermission = "admin",
            OutdoorTemp = device.Room?.House?.OutdoorTemp,
            OutdoorHumidity = device.Room?.House?.OutdoorHumidity,
            OutdoorCo2 = device.Room?.House?.OutdoorCo2
        });
    }
}
