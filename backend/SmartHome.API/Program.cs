using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.FileProviders; 
using Npgsql;
using SmartHome.API.Models;
using SmartHome.API.Services;

// Разрешаем сохранять DateTime с Kind=Utc в поля timestamp without time zone
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddDbContext<SmartHomeContext>(options =>
    options.UseNpgsql(connectionString)); // Используем connectionString напрямую

// Настройка JWT Аутентификации
var jwtSettings = builder.Configuration.GetSection("Jwt");
var key = Encoding.ASCII.GetBytes(jwtSettings["Key"]!);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false; // Для локальной разработки можно false
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(key)
    };
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddHttpClient();

builder.Services.Configure<SmartHome.API.Services.TuyaCloudOptions>(
    builder.Configuration.GetSection(SmartHome.API.Services.TuyaCloudOptions.SectionName));
builder.Services.AddSingleton<SmartHome.API.Services.TuyaCloudRuntimeConfig>();
builder.Services.AddHttpClient(nameof(SmartHome.API.Services.TuyaCloudLocalKeyService), client =>
{
    client.Timeout = TimeSpan.FromSeconds(45);
});
builder.Services.AddSingleton<SmartHome.API.Services.TuyaCloudLocalKeyService>();

builder.Services.AddSingleton<SmartHome.API.Services.TuyaServiceLocator>();

builder.Services.AddSingleton<SmartHome.API.Services.EventPublisher>(sp =>
{
    var logger = sp.GetRequiredService<ILogger<SmartHome.API.Services.EventPublisher>>();
    return new SmartHome.API.Services.EventPublisher(logger);
});
builder.Services.AddHostedService<SmartHome.API.Services.ScheduleWorker>();
builder.Services.AddHostedService<SmartHome.API.Services.SensorDataWorker>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Необходимо для SSE
    });
});

// Настройка Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo { Title = "SmartHome API", Version = "v1" });
    
    // Добавляем кнопку авторизации в Swagger UI
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
});

var app = builder.Build();

// Пользователь demo для эмулятора (пароль из конфига Emulator:DemoPassword, по умолчанию "demo")
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<SmartHomeContext>();
    var bootLogger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DatabaseSchemaBootstrap");
    DatabaseSchemaBootstrap.ApplyAsync(db, bootLogger).GetAwaiter().GetResult();

    var demoUser = db.Users.AsNoTracking().FirstOrDefault(u => u.Username == "demo");
    if (demoUser == null)
    {
        var demoPassword = builder.Configuration["Emulator:DemoPassword"] ?? "demo";
        db.Users.Add(new User
        {
            Username = "demo",
            Email = "demo@local",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(demoPassword),
            Role = "user"
        });
        db.SaveChanges();
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// app.UseHttpsRedirection(); // Отключим HTTPS редирект для упрощения локальной разработки (чтобы не было проблем с сертификатами)

app.UseCors("AllowFrontend");

// Явно указываем путь к wwwroot, чтобы избежать проблем с путями при запуске
var wwwrootPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
if (!Directory.Exists(wwwrootPath))
{
    Directory.CreateDirectory(wwwrootPath);
}

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(wwwrootPath),
    RequestPath = ""
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
