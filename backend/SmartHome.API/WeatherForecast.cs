namespace SmartHome.API;

public class WeatherForecast
{
    public DateOnly Date { get; set; }

    public decimal TemperatureC { get; set; }

    public decimal TemperatureF => 32m + (TemperatureC / 0.5556m);

    public string? Summary { get; set; }

    // Доп. поля, чтобы фронт мог рисовать корректные иконки/ветер
    public bool HasLocation { get; set; }
    public string? City { get; set; }
    public int Clouds { get; set; } // 0..3
    public bool IsNight { get; set; }
    public bool IsRain { get; set; }
    public bool IsSnow { get; set; }
    public decimal WindSpeedMps { get; set; }
    public int WindLevel { get; set; } // 1..3 (Beaufort approx)
}
