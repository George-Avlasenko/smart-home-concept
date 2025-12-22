using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SmartHome.API.Models;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace SmartHome.API.Services;

public class SensorDataWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SensorDataWorker> _logger;
    private readonly Random _random = new Random();

    public SensorDataWorker(IServiceProvider serviceProvider, ILogger<SensorDataWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("SensorDataWorker started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var context = scope.ServiceProvider.GetRequiredService<SmartHomeContext>();
                    
                    // Find devices that can produce readings
                    var devices = await context.Devices
                        .Where(d => d.Type == "sensor" || d.Type == "thermostat" || (d.Type == "kettle" && d.Status == DeviceStatus.active)) 
                        .ToListAsync(stoppingToken);

                    foreach (var device in devices)
                    {
                        if (device.Type == "sensor")
                        {
                            context.SensorReadings.Add(new SensorReading
                            {
                                DeviceId = device.DeviceId,
                                ReadingType = "temperature",
                                Value = (decimal)(20 + _random.NextDouble() * 5),
                                Unit = "°C",
                                RecordedAt = DateTime.UtcNow
                            });
                            context.SensorReadings.Add(new SensorReading
                            {
                                DeviceId = device.DeviceId,
                                ReadingType = "humidity",
                                Value = (decimal)(40 + _random.NextDouble() * 20),
                                Unit = "%",
                                RecordedAt = DateTime.UtcNow
                            });
                        }
                        else if (device.Type == "thermostat")
                        {
                            context.SensorReadings.Add(new SensorReading
                            {
                                DeviceId = device.DeviceId,
                                ReadingType = "temperature",
                                Value = (decimal)(18 + _random.NextDouble() * 4),
                                Unit = "°C",
                                RecordedAt = DateTime.UtcNow
                            });
                        }
                        else if (device.Type == "kettle")
                        {
                             context.SensorReadings.Add(new SensorReading
                            {
                                DeviceId = device.DeviceId,
                                ReadingType = "temperature",
                                Value = (decimal)(20 + _random.NextDouble() * 80),
                                Unit = "°C",
                                RecordedAt = DateTime.UtcNow
                            });
                        }
                    }
                    
                    if (devices.Any())
                    {
                        await context.SaveChangesAsync(stoppingToken);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SensorDataWorker");
            }

            // Wait 5 minutes
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }
}

