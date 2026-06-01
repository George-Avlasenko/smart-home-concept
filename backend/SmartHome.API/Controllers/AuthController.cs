using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartHome.API.DTOs;
using SmartHome.API.Models;

namespace SmartHome.API.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly SmartHomeContext _context;
    private readonly IConfiguration _configuration;

    public AuthController(SmartHomeContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    [HttpPost("register")]
    public async Task<ActionResult<User>> Register(RegisterDto request)
    {
        try 
        {
            // Проверка на существование пользователя
            if (await _context.Users.AnyAsync(u => u.Username == request.Username))
            {
                return BadRequest(new { error = "Пользователь с таким именем уже существует." });
            }

            if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            {
                return BadRequest(new { error = "Email уже используется." });
            }

            // Хеширование пароля
            string passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

            var user = new User
            {
                Username = request.Username,
                Email = request.Email,
                PasswordHash = passwordHash,
                FullName = request.FullName,
                // Если имя пользователя "admin" (в любом регистре), даем права администратора
                Role = request.Username.ToLower() == "admin" ? "admin" : "user",
                IsBlocked = false
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok("Пользователь успешно зарегистрирован.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error during registration: {ex.Message}");
            return StatusCode(500, "Произошла ошибка при регистрации. Попробуйте позже.");
        }
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login(LoginDto request)
    {
        try
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == request.Username);

            if (user == null)
            {
                return BadRequest(new { error = "Пользователь не найден." });
            }

            if (user.IsBlocked == true) // Явное приведение для nullable bool
            {
                return StatusCode(403, new { code = "account_blocked", error = "Ваш аккаунт заблокирован администратором." });
            }

            // Проверка пароля
            if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                return BadRequest(new { error = "Неверный пароль." });
            }

            // Генерация токена
            string token = CreateToken(user);

            return Ok(new AuthResponseDto
            {
                Token = token,
                Username = user.Username,
                Role = user.Role ?? "user",
                UserId = user.UserId,
                AvatarUrl = user.AvatarUrl
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error during login: {ex.Message}");
            // Возвращаем generic ошибку, чтобы не пугать пользователя деталями
            return StatusCode(500, "Произошла внутренняя ошибка сервера.");
        }
    }

    private string CreateToken(User user)
    {
        var jwtSettings = _configuration.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Key"]!));

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role ?? "user"),
            new Claim("userId", user.UserId.ToString())
        };

        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256Signature);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddDays(1), // Токен живет 1 день
            SigningCredentials = creds,
            Issuer = jwtSettings["Issuer"],
            Audience = jwtSettings["Audience"]
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);

        return tokenHandler.WriteToken(token);
    }
}
