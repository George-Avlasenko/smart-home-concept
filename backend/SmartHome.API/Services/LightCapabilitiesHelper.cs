namespace SmartHome.API.Services;

/// <summary>Возможности света из фич каталога (CCT / RGB) для UI карточки.</summary>
public static class LightCapabilitiesHelper
{
    public static Dictionary<string, object> FromCatalogFeatures(IReadOnlyList<string>? features)
    {
        var cct = false;
        var rgb = false;
        if (features != null)
        {
            foreach (var f in features)
            {
                if (f.Contains("CCT", StringComparison.OrdinalIgnoreCase)) cct = true;
                if (f.Contains("RGB", StringComparison.OrdinalIgnoreCase)) rgb = true;
            }
        }

        return new Dictionary<string, object> { ["cct"] = cct, ["rgb"] = rgb };
    }
}
