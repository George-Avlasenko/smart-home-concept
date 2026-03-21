using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

var config = new ConfigurationBuilder()
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json", optional: true)
    .AddEnvironmentVariables()
    .Build();

var apiBase = config["ApiBaseUrl"] ?? "http://localhost:5000";
var demoPassword = config["DemoPassword"] ?? "demo";
var intervalSec = int.TryParse(config["IntervalSeconds"], out var s) ? s : 60;
var enabled = config["EmulationEnabled"] != "false" && config["EmulationEnabled"] != "0";

if (!enabled)
{
    Console.WriteLine("Emulation disabled by config. Exit.");
    return 0;
}

using var http = new HttpClient { BaseAddress = new Uri(apiBase.TrimEnd('/')) };
http.DefaultRequestHeaders.Add("Accept", "application/json");

// 1) Login
var loginResp = await http.PostAsJsonAsync("/api/auth/login", new { username = "demo", password = demoPassword });
if (!loginResp.IsSuccessStatusCode)
{
    Console.WriteLine("Login failed: " + await loginResp.Content.ReadAsStringAsync());
    return 1;
}
var loginJson = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
var token = loginJson.GetProperty("token").GetString();
if (string.IsNullOrEmpty(token))
{
    Console.WriteLine("No token in response.");
    return 1;
}
http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

// 2) Ensure demo house and get devices
var ensureResp = await http.PostAsync("/api/emulator/ensure-demo-house", null);
ensureResp.EnsureSuccessStatusCode();
var ensureJson = await ensureResp.Content.ReadFromJsonAsync<JsonElement>();
var houseId = ensureJson.GetProperty("houseId").GetInt32();
var devices = ensureJson.GetProperty("devices").EnumerateArray().ToList();

var sensorsByRoom = new Dictionary<int, List<int>>();
int? thermostatId = null;
var kettleIds = new List<int>();
foreach (var d in devices)
{
    var deviceId = d.GetProperty("deviceId").GetInt32();
    var type = d.GetProperty("type").GetString() ?? "";
    var roomId = d.GetProperty("roomId").GetInt32();
    if (type == "sensor")
    {
        if (!sensorsByRoom.ContainsKey(roomId)) sensorsByRoom[roomId] = new List<int>();
        sensorsByRoom[roomId].Add(deviceId);
    }
    else if (type == "thermostat") thermostatId = deviceId;
    else if (type == "kettle") kettleIds.Add(deviceId);
}

        // Room state: temp, humidity, co2. Init defaults.
        var roomState = new Dictionary<int, (double t, double h, double c)>();
        foreach (var roomId in sensorsByRoom.Keys)
            roomState[roomId] = (21.0, 45.0, 450.0);

        var kettleWaterTemp = new Dictionary<int, double>();
foreach (var kid in kettleIds) kettleWaterTemp[kid] = 20.0;

var rnd = new Random();
var run = true;
Console.CancelKeyPress += (_, e) => { e.Cancel = true; run = false; };

Console.WriteLine($"Emulator started. HouseId={houseId}, interval={intervalSec}s. Press Ctrl+C to stop.");

while (run)
{
    try
    {
        var now = DateTime.Now;
        var hour = now.Hour + now.Minute / 60.0;

        // Улица: от времени суток + небольшой шум (без резких скачков)
        // Температура улицы подогнана под текущее ожидание демо: около +4..+7°C
        // (чтобы карточка "Погода на улице" не расходилась с реальной оценкой в окне теста).
        var outdoorTemp = 1.0 + 8.0 * Math.Sin((hour - 6) * Math.PI / 12.0) + (rnd.NextDouble() - 0.5) * 0.6;
        var outdoorHumidity = 50.0 + 20.0 * Math.Sin((hour - 3) * Math.PI / 12.0) + (rnd.NextDouble() - 0.5) * 2.0;
        var outdoorCo2 = 400.0 + (rnd.NextDouble() - 0.5) * 20.0;

        // Получить текущее состояние устройств (термостат, окна, увлажнитель, вентиляция, чайники)
        bool acOn = false;
        double targetTemp = 21;
        var windowOpen = new Dictionary<int, bool>();
        bool ventilationOn = false;
        bool humidifierOn = false;
        var kettleOn = new Dictionary<int, bool>();
        var kettleTarget = new Dictionary<int, double>();

        try
        {
            var devResp = await http.GetAsync("/api/devices");
            if (devResp.IsSuccessStatusCode)
            {
                var devList = await devResp.Content.ReadFromJsonAsync<List<JsonElement>>();
                if (devList != null)
                {
                    foreach (var dev in devList)
                    {
                        var hId = dev.TryGetProperty("houseId", out var hp) ? hp.GetInt32() : 0;
                        if (hId != houseId) continue;
                        var id = dev.GetProperty("deviceId").GetInt32();
                        var type = dev.GetProperty("type").GetString() ?? "";
                        var status = dev.GetProperty("status").GetString() ?? "inactive";
                        var roomId = dev.GetProperty("roomId").GetInt32();
                        var active = status.Equals("active", StringComparison.OrdinalIgnoreCase);

                        if (type == "thermostat") { acOn = active; if (dev.TryGetProperty("settings", out var st) && st.TryGetProperty("targetTemp", out var tt)) targetTemp = tt.GetDouble(); }
                        else if (type == "window") windowOpen[roomId] = active;
                        else if (type == "ventilation") ventilationOn = active;
                        else if (type == "humidifier") humidifierOn = active;
                        else if (type == "kettle")
                        {
                            kettleOn[id] = active;
                            kettleTarget[id] = 100;
                            if (dev.TryGetProperty("settings", out var kst) && kst.TryGetProperty("targetTemp", out var ktt)) kettleTarget[id] = ktt.GetDouble();
                            if (dev.TryGetProperty("settings", out var ks) && ks.TryGetProperty("currentTemp", out var kct)) kettleWaterTemp[id] = kct.GetDouble();
                        }
                    }
                }
            }
        }
        catch { /* use defaults */ }

        // Дрейф комнат к улице + эффекты устройств
        var newRoomState = new Dictionary<int, (double t, double h, double c)>();
        foreach (var kv in roomState)
        {
            var roomId = kv.Key;
            var (t, h, c) = kv.Value;
            // Мягкий дрейф — меньше скачков от тика к тику, график без пульса
            const double driftClosed = 0.004;
            const double windowDrift = 0.05;
            const double ventDrift = 0.02;

            var driftT = driftClosed;
            if (windowOpen.GetValueOrDefault(roomId)) driftT = windowDrift;
            else if (ventilationOn) driftT = ventDrift;

            t = t + (outdoorTemp - t) * driftT;
            h = h + (outdoorHumidity - h) * (windowOpen.GetValueOrDefault(roomId) ? 0.04 : (ventilationOn ? 0.02 : 0.01));
            c = c + (outdoorCo2 - c) * (windowOpen.GetValueOrDefault(roomId) ? 0.08 : (ventilationOn ? 0.03 : 0.01));

            if (acOn)
            {
                var step = 0.012;
                if (t > targetTemp) t = Math.Max(targetTemp, t - step * (t - targetTemp));
                else if (t < targetTemp) t = Math.Min(targetTemp, t + step * (targetTemp - t));
            }
            if (humidifierOn) h = Math.Min(70, h + 0.15);

            t = Math.Clamp(t, -5, 40);
            h = Math.Clamp(h, 10, 95);
            c = Math.Clamp(c, 350, 2000);
            newRoomState[roomId] = (t, h, c);
        }
        roomState = newRoomState;

        // Чайники: при включении — нагрев до целевой температуры, при выключении — остывание к комнатной
        foreach (var kid in kettleIds)
        {
            var on = kettleOn.GetValueOrDefault(kid, false);
            var target = kettleTarget.GetValueOrDefault(kid, 100);
            if (on)
            {
                kettleWaterTemp[kid] = kettleWaterTemp[kid] + (target - kettleWaterTemp[kid]) * 0.28;
                kettleWaterTemp[kid] = Math.Clamp(kettleWaterTemp[kid], 15, 100);
            }
            else
            {
                kettleWaterTemp[kid] = kettleWaterTemp[kid] + (22.0 - kettleWaterTemp[kid]) * 0.03;
                kettleWaterTemp[kid] = Math.Clamp(kettleWaterTemp[kid], 15, 100);
            }
        }

        // Собрать readings: датчики (temp, humidity, co2) и чайники (waterTemp)
        var readings = new List<object>();
        foreach (var kv in sensorsByRoom)
        {
            var (t, h, c) = roomState[kv.Key];
            foreach (var devId in kv.Value)
                readings.Add(new { deviceId = devId, temperature = Math.Round(t, 1), humidity = Math.Round(h, 1), co2 = Math.Round(c, 0) });
        }
        foreach (var kid in kettleIds)
            readings.Add(new { deviceId = kid, waterTemp = Math.Round(kettleWaterTemp[kid], 1) });

        var body = new
        {
            houseId,
            outdoor = new { temp = Math.Round(outdoorTemp, 1), humidity = Math.Round(outdoorHumidity, 1), co2 = Math.Round(outdoorCo2, 0) },
            readings
        };

        var bodyJson = JsonSerializer.Serialize(body);
        var content = new StringContent(bodyJson, Encoding.UTF8, "application/json");
        var postResp = await http.PostAsync("/api/emulator/readings", content);
        if (!postResp.IsSuccessStatusCode)
            Console.WriteLine("POST readings failed: " + await postResp.Content.ReadAsStringAsync());
        else
            Console.WriteLine($"[{now:HH:mm:ss}] OK outdoor T={outdoorTemp:F1} H={outdoorHumidity:F0} CO2={outdoorCo2:F0}");
    }
    catch (Exception ex)
    {
        Console.WriteLine("Error: " + ex.Message);
    }

    await Task.Delay(TimeSpan.FromSeconds(intervalSec));
}

Console.WriteLine("Emulator stopped.");
return 0;
