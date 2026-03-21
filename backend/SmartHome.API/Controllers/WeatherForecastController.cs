using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHome.API.Models;

namespace SmartHome.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WeatherForecastController : ControllerBase
{
    private readonly ILogger<WeatherForecastController> _logger;
    private readonly SmartHomeContext _context;

    public WeatherForecastController(ILogger<WeatherForecastController> logger, SmartHomeContext context)
    {
        _logger = logger;
        _context = context;
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

        // Город влияет на погоду детерминированно (без Random),
        // но базу температуры/ветра берём из outdoor-полей дома (эмулятор).
        var citySeed = StableHashU64(normalizedCity!.ToLowerInvariant());
        var cityDeltaTemp = (((decimal)(citySeed % 10001UL) / 10000m) - 0.5m) * 8.0m; // [-4..+4]°C

        // Температуру/влажность берём из outdoor-состояния дома (эмулятор).
        // Если outdoor-поля для конкретного houseId ещё не проставлены — берём первый дом с outdoor.
        var house = houseId != null
            ? await _context.Houses.FirstOrDefaultAsync(h => h.HouseId == houseId.Value)
            : await _context.Houses.OrderBy(h => h.HouseId).FirstOrDefaultAsync();

        if (house == null || house.OutdoorTemp == null || house.OutdoorHumidity == null)
        {
            house = await _context.Houses.FirstOrDefaultAsync(h => h.OutdoorTemp != null && h.OutdoorHumidity != null);
        }

        var temp = house?.OutdoorTemp ?? 0m;
        var humidity = house?.OutdoorHumidity ?? 50m;
        var tempAdj = Math.Clamp(temp + cityDeltaTemp, -30m, 60m);

        // Облака по влажности (как в старой логике фронта).
        var clouds = humidity < 35m ? 0 : humidity < 48m ? 1 : humidity < 63m ? 2 : 3;

        var isSnow = tempAdj <= 0m && clouds >= 2;
        var isRain = !isSnow && tempAdj > 0m && clouds == 3;

        // Ветер: чтобы было "почти нет" при близкой к 50 влажности.
        var wind = (Math.Abs(humidity - 50m) / 50m) * 0.8m + 0.05m; // ~0.05..0.85
        wind = Math.Clamp(wind, 0m, 3m);
        var windRounded = (decimal)Math.Round(wind, 1, MidpointRounding.AwayFromZero);

        var windLevel = windRounded < 0.7m ? 1 : windRounded < 1.6m ? 2 : 3;

        var summary = isSnow ? "Snow" : isRain ? "Rain" : clouds == 0 ? "Clear" : "Cloudy";

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

    private static ulong StableHashU64(string input)
    {
        // FNV-1a 64-bit (детерминированно между запусками)
        const ulong offsetBasis = 14695981039346656037UL;
        const ulong prime = 1099511628211UL;

        ulong hash = offsetBasis;
        foreach (var b in input)
        {
            hash ^= b;
            hash *= prime;
        }

        return hash;
    }
}
