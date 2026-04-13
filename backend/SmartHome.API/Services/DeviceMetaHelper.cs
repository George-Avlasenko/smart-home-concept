using System.Text.Json;

namespace SmartHome.API.Services;

/// <summary>
/// MetaData устройства хранится как JSON; Dictionary&lt;string, object&gt; даёт вложенные JsonElement и ломает сериализацию в API.
/// Здесь приводим к обычным Dictionary/List/примитивам для корректного JSON на фронте (settings.tuya).
/// </summary>
public static class DeviceMetaHelper
{
    public static Dictionary<string, object> ParseToNestedObjects(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new Dictionary<string, object>();
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return new Dictionary<string, object>();
            return ParseObject(doc.RootElement);
        }
        catch
        {
            return new Dictionary<string, object>();
        }
    }

    private static Dictionary<string, object> ParseObject(JsonElement el)
    {
        var dict = new Dictionary<string, object>();
        foreach (var p in el.EnumerateObject())
            dict[p.Name] = ParseValue(p.Value);
        return dict;
    }

    private static object ParseValue(JsonElement el) => el.ValueKind switch
    {
        JsonValueKind.Object => ParseObject(el),
        JsonValueKind.Array => el.EnumerateArray().Select(ParseValue).ToList(),
        JsonValueKind.String => el.GetString() ?? string.Empty,
        JsonValueKind.Number => el.TryGetInt64(out var l) ? l : el.GetDouble(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Null => null!,
        _ => el.ToString()
    };
}
