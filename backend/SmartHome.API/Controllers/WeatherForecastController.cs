using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHome.API.Models;
using SmartHome.API.Services;
using System.Text.Json;

namespace SmartHome.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WeatherForecastController : ControllerBase
{
    private readonly ILogger<WeatherForecastController> _logger;
    private readonly SmartHomeContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly EventPublisher _eventPublisher;

    public WeatherForecastController(
        ILogger<WeatherForecastController> logger,
        SmartHomeContext context,
        IHttpClientFactory httpClientFactory,
        EventPublisher eventPublisher)
    {
        _logger = logger;
        _context = context;
        _httpClientFactory = httpClientFactory;
        _eventPublisher = eventPublisher;
    }

    [HttpGet(Name = "GetWeatherForecast")]
    public async Task<WeatherForecast[]> Get([FromQuery] int? houseId, [FromQuery] string? city)
    {
        var now = DateTime.Now;
        var isNight = now.Hour < 6 || now.Hour >= 20;

        var normalizedCity = string.IsNullOrWhiteSpace(city) ? null : city.Trim();

        // Если локацию не ввели — показываем заглушку (0°C) и HasLocation=false,
        // чтобы фронт вывел подсказку.
        if (normalizedCity == null)
        {
            return await Task.FromResult(new[]
            {
                new WeatherForecast
                {
                    Date = DateOnly.FromDateTime(now),
                    HasLocation = false,
                    City = null,
                    TemperatureC = 0m,
                    Clouds = 0,
                    IsNight = isNight,
                    IsRain = false,
                    IsSnow = false,
                    WindSpeedMps = 0m,
                    WindLevel = 1,
                    Summary = "No location"
                }
            });
        }

        var weather = await TryFetchOpenMeteoAsync(normalizedCity!);
        if (weather == null)
        {
            // Фолбек, если внешний API недоступен.
            return new[]
            {
                new WeatherForecast
                {
                    Date = DateOnly.FromDateTime(now),
                    HasLocation = true,
                    City = normalizedCity,
                    TemperatureC = 0m,
                    Clouds = 0,
                    IsNight = isNight,
                    IsRain = false,
                    IsSnow = false,
                    WindSpeedMps = 0m,
                    WindLevel = 1,
                    Summary = "Unavailable"
                }
            };
        }

        var tempAdj = weather.TemperatureC;
        var humidity = weather.Humidity;
        var clouds = weather.Clouds;
        var isSnow = weather.IsSnow;
        var isRain = weather.IsRain;
        var windRounded = weather.WindSpeedMps;
        // Грубые 3 уровня для иконки ветра (км/ч из Open-Meteo по умолчанию).
        var windLevel = windRounded < 12.0m ? 1 : windRounded < 29.0m ? 2 : 3;
        var summary = weather.Summary;

        if (houseId.HasValue)
        {
            var house = await _context.Houses.FirstOrDefaultAsync(h => h.HouseId == houseId.Value);
            if (house != null)
            {
                house.OutdoorTemp = tempAdj;
                house.OutdoorHumidity = humidity;
                await _context.SaveChangesAsync();
                await _eventPublisher.PublishAsync("house.outdoor_updated", new
                {
                    houseId = house.HouseId,
                    outdoorTemp = house.OutdoorTemp,
                    outdoorHumidity = house.OutdoorHumidity,
                    outdoorCo2 = house.OutdoorCo2
                });
            }
        }

        return await Task.FromResult(new[]
        {
            new WeatherForecast
            {
                Date = DateOnly.FromDateTime(now),
                HasLocation = true,
                City = normalizedCity,
                TemperatureC = tempAdj,
                Clouds = clouds,
                IsNight = isNight,
                IsRain = isRain,
                IsSnow = isSnow,
                WindSpeedMps = windRounded,
                WindLevel = windLevel,
                Summary = summary
            }
        });
    }

    private async Task<LiveWeatherDto?> TryFetchOpenMeteoAsync(string city)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(8);

            var geoUrl = $"https://geocoding-api.open-meteo.com/v1/search?name={Uri.EscapeDataString(city)}&count=1&language=ru&format=json";
            var geoResp = await client.GetAsync(geoUrl);
            if (!geoResp.IsSuccessStatusCode) return null;

            using var geoDoc = JsonDocument.Parse(await geoResp.Content.ReadAsStringAsync());
            var results = geoDoc.RootElement.TryGetProperty("results", out var r) ? r : default;
            if (results.ValueKind != JsonValueKind.Array || results.GetArrayLength() == 0) return null;
            var first = results[0];
            var lat = first.GetProperty("latitude").GetDouble();
            var lon = first.GetProperty("longitude").GetDouble();

            var weatherUrl =
                $"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,cloud_cover,precipitation,is_day,weather_code,wind_speed_10m";
            var weatherResp = await client.GetAsync(weatherUrl);
            if (!weatherResp.IsSuccessStatusCode) return null;

            using var weatherDoc = JsonDocument.Parse(await weatherResp.Content.ReadAsStringAsync());
            var current = weatherDoc.RootElement.GetProperty("current");

            var temp = (decimal)current.GetProperty("temperature_2m").GetDouble();
            var hum = (decimal)current.GetProperty("relative_humidity_2m").GetDouble();
            var cloudsRaw = current.GetProperty("cloud_cover").GetDouble();
            var clouds = cloudsRaw < 35 ? 0 : cloudsRaw < 48 ? 1 : cloudsRaw < 63 ? 2 : 3;
            var wind = (decimal)Math.Round(current.GetProperty("wind_speed_10m").GetDouble(), 1, MidpointRounding.AwayFromZero);
            var isDay = current.GetProperty("is_day").GetInt32() == 1;
            var code = current.GetProperty("weather_code").GetInt32();

            var isSnow = code is 71 or 73 or 75 or 77 or 85 or 86;
            var isRain = code is 51 or 53 or 55 or 56 or 57 or 61 or 63 or 65 or 66 or 67 or 80 or 81 or 82;
            var summary = isSnow ? "Snow" : isRain ? "Rain" : clouds == 0 ? "Clear" : "Cloudy";

            return new LiveWeatherDto
            {
                TemperatureC = temp,
                Humidity = hum,
                Clouds = clouds,
                IsSnow = isSnow,
                IsRain = isRain,
                IsDay = isDay,
                WindSpeedMps = wind,
                Summary = summary
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch weather for city {City}", city);
            return null;
        }
    }

    private sealed class LiveWeatherDto
    {
        public decimal TemperatureC { get; set; }
        public decimal Humidity { get; set; }
        public int Clouds { get; set; }
        public bool IsSnow { get; set; }
        public bool IsRain { get; set; }
        public bool IsDay { get; set; }
        public decimal WindSpeedMps { get; set; }
        public string Summary { get; set; } = "Cloudy";
    }
}
