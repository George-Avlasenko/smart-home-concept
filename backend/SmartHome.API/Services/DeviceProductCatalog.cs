namespace SmartHome.API.Services;

/// <summary>
/// Каталог устройств, поддерживаемых экосистемой (как у вендорских приложений).
/// </summary>
public static class DeviceProductCatalog
{
    public sealed record Product(
        string Sku,
        string DisplayName,
        string Manufacturer,
        string Type,
        string SuggestedName,
        string Category,
        IReadOnlyList<string>? Features = null,
        string? TuyaProductLabel = null,
        IReadOnlyList<string>? TuyaProductIds = null,
        IReadOnlyList<string>? TuyaProductNameHints = null,
        IReadOnlyList<string>? TuyaProductKeys = null);

    public static readonly IReadOnlyList<Product> All = new List<Product>
    {
        // Свет
        new("tuya-ceiling-40w-cct", "Потолочный светильник Smart 40 Вт, CCT", "Tuya", "light", "Потолочный CCT", "Освещение", ["Wi-Fi", "CCT"], "Tuya CEILING CCT TC40CCT"),
        new("tuya-garland-usb", "Гирлянда Smart Wi-Fi RGB", "Tuya", "light", "Гирлянда", "Освещение", ["Wi-Fi", "RGB"], "Tuya GARLAND RGB GLRGB01"),
        new("tuya-a60-cct-wifi", "Лампа A60 Wi-Fi, тёплый–холодный спектр", "Tuya", "light", "Лампа A60 CCT", "Освещение", ["Wi-Fi", "CCT"], "Tuya A60 CCT BULB A60CCT"),
        new("tuya-zigbee-bulb-cct", "Лампа Zigbee 3.0 CCT", "Tuya", "light", "Лампа Zigbee CCT", "Освещение", ["Zigbee", "CCT"], "Tuya ZIGBEE CCT BULB ZB-CCT"),
        // LAN-скан без product_name; точное имя модели приходит из Tuya Cloud.
        new("sh-light-tuya-01", "Умная лампа Wi-Fi", "Tuya", "light", "Лампа", "Освещение", ["Wi-Fi", "LAN"], "Tuya LAN TL01"),

        // Совместимость со старыми SKU из каталога
        new("sh-bulb-wifi-cct", "Светодиодная лампа Wi-Fi CCT", "Tuya", "light", "Лампа CCT", "Освещение", ["Wi-Fi", "CCT"], "Tuya LED BULB CCT W509-CCT",
            TuyaProductNameHints: ["cct bulb", "white bulb", "led bulb"]),
        new("sh-bulb-wifi-rgb", "Светодиодная лампа Wi-Fi RGB+CCT", "Tuya", "light", "Лампа RGB", "Освещение", ["Wi-Fi", "RGB", "CCT"], "Tuya LED BULB W509Z2",
            TuyaProductIds: ["n9apqaagw8z2ktkx"],
            TuyaProductNameHints: ["led bulb w509z2", "w509z2", "led bulb"],
            TuyaProductKeys: ["keyndnn7n7jamtxj"]),
        new("sh-bulb-blewifi-rgb", "Лампа BLE + Wi-Fi RGB", "Tuya", "light", "Лампа", "Освещение", ["BLE+Wi-Fi", "RGB"], "Tuya BLE+WIFI RGB BULB BLW-RGB"),
        new("sh-bulb-zigbee-cct", "Лампа Zigbee CCT", "Tuya", "light", "Лампа Zigbee", "Освещение", ["Zigbee", "CCT"], "Tuya ZIGBEE CCT BULB ZB-CCT-01"),
        new("sh-bulb-ble-cct", "Лампа Bluetooth CCT", "Tuya", "light", "Лампа BLE", "Освещение", ["BLE", "CCT"], "Tuya BLE CCT BULB BLE-CCT-01"),
        new("sh-garland-wifi-rgb", "Гирлянда Wi-Fi RGB", "Tuya", "light", "Гирлянда", "Освещение", ["Wi-Fi", "RGB"], "Tuya GARLAND RGB GL-RGB-01"),
        new("sh-desk-wifi-rgb", "Настольная лампа Wi-Fi RGB", "Tuya", "light", "Настольная лампа", "Освещение", ["Wi-Fi", "RGB"], "Tuya DESK RGB LAMP DK-RGB-01"),
        new("sh-desk-wifi-cct-01", "Настольная лампа Wi-Fi CCT", "Tuya", "light", "Настольная лампа", "Освещение", ["Wi-Fi", "CCT"], "Tuya DESK CCT LAMP DK-CCT-01"),
        new("sh-desk-ble-rgb-01", "Настольная лампа BLE RGB", "Tuya", "light", "Настольная лампа", "Освещение", ["BLE", "RGB"], "Tuya DESK RGB LAMP DK-BLE-RGB-01"),
        new("sh-desk-zigbee-cct-01", "Настольная лампа Zigbee CCT", "Tuya", "light", "Настольная лампа", "Освещение", ["Zigbee", "CCT"], "Tuya DESK CCT LAMP DK-ZB-CCT-01"),
        new("sh-ceiling-zigbee-cct", "Потолочный светильник Zigbee CCT", "Tuya", "light", "Потолочное освещение", "Освещение", ["Zigbee", "CCT"], "Tuya CEILING ZIGBEE CCT CL-ZB-CCT"),
        new("sh-strip-wifi-rgb", "Светодиодная лента Wi-Fi RGB", "Tuya", "light", "Лента света", "Освещение", ["Wi-Fi", "RGB"], "Tuya RGB STRIP ST-RGB-01"),
        new("sh-strip-wifi-rgbcct-01", "Светодиодная лента Wi-Fi RGB+CCT", "Tuya", "light", "Лента света", "Освещение", ["Wi-Fi", "RGB", "CCT"], "Tuya RGBCCT STRIP ST-RGBCCT-01"),
        new("sh-strip-ble-rgb-01", "Светодиодная лента BLE RGB", "Tuya", "light", "Лента света", "Освещение", ["BLE", "RGB"], "Tuya RGB STRIP ST-BLE-RGB-01"),
        new("sh-strip-zigbee-cct-01", "Светодиодная лента Zigbee CCT", "Tuya", "light", "Лента света", "Освещение", ["Zigbee", "CCT"], "Tuya CCT STRIP ST-ZB-CCT-01"),

        // Климат
        new("sh-thermostat-01", "Кондиционер с Wi-Fi-модулем", "Midea", "thermostat", "Кондиционер", "Климат", ["Wi-Fi"], "Midea AC-MD01"),
        new("sh-thermostat-02", "Кондиционер инверторный Wi-Fi", "Gree", "thermostat", "Кондиционер", "Климат", ["Wi-Fi", "ION"], "Gree AC-GR02"),
        new("sh-thermostat-03", "Кондиционер мульти-сплит Zigbee", "Haier", "thermostat", "Кондиционер", "Климат", ["Zigbee"], "Haier AC-HR03"),
        new("sh-humidifier-01", "Увлажнитель с Wi-Fi", "Deerma", "humidifier", "Увлажнитель", "Климат", ["Wi-Fi"], "Deerma HM-DR01"),
        new("sh-humidifier-02", "Увлажнитель ультразвуковой BLE", "Xiaomi", "humidifier", "Увлажнитель", "Климат", ["BLE"], "Xiaomi HM-UL02"),
        new("sh-humidifier-03", "Увлажнитель Zigbee", "Tuya", "humidifier", "Увлажнитель", "Климат", ["Zigbee"], "Tuya HUMIDIFIER HM-ZB-03"),
        new("sh-ventilation-01", "Приточная вентиляция с Wi-Fi", "Vents", "ventilation", "Вентиляция", "Климат", ["Wi-Fi"], "Vents VT-WF01"),
        new("sh-ventilation-02", "Вытяжная вентиляция BLE + Wi-Fi", "Blauberg", "ventilation", "Вентиляция", "Климат", ["BLE+Wi-Fi"], "Blauberg VT-BW02"),
        new("sh-ventilation-03", "Рекуператор Zigbee", "Tion", "ventilation", "Вентиляция", "Климат", ["Zigbee"], "Tion VT-ZB03"),
        new("sh-sensor-01", "Датчик климата с Wi-Fi", "Tuya", "sensor", "Датчик", "Климат", ["Wi-Fi", "Температура", "Влажность", "CO2"], "Tuya CLIMATE SENSOR THS-CO2-01"),

        // Питание / быт
        new("sh-switch-01", "Настенный выключатель Wi-Fi", "Tuya", "switch", "Выключатель", "Бытовая техника", ["Wi-Fi"], "Tuya WALL SWITCH SW-WF-01"),
        new("sh-outlet-01", "Умная розетка Wi-Fi", "Gosund", "outlet", "Розетка", "Бытовая техника", ["Wi-Fi"], "Gosund SOCKET GS-SP1"),
        new("sh-outlet-tuya-01", "Умная розетка Tuya Wi‑Fi", "Tuya", "outlet", "Розетка", "Бытовая техника", ["Wi-Fi", "Энергомониторинг"], "Tuya Smart Plug",
            TuyaProductNameHints: ["smart plug", "wifi smart plug", "socket", "outlet", "plug"],
            TuyaProductKeys: ["keyge8wsy99n5pr7"]),
        new("sh-kettle-01", "Умный чайник Wi-Fi", "Xiaomi", "kettle", "Чайник", "Бытовая техника", ["Wi-Fi"], "Xiaomi KETTLE XM-KTL01"),
        new("sh-vacuum-01", "Робот-пылесос с приложением", "Roborock", "vacuum", "Пылесос", "Бытовая техника", ["Wi-Fi"], "Roborock VACUUM RR-S7"),

        // Энергия — автоматы
        new("sh-breaker-ble-01", "Автоматический выключатель BLE", "Tuya", "switch", "Автомат", "Энергия", ["BLE"], "Tuya BREAKER BLE BRK-BLE-01"),
        new("sh-breaker-wifi-01", "Автоматический выключатель Wi-Fi", "Tuya", "switch", "Автомат", "Энергия", ["Wi-Fi"], "Tuya BREAKER WIFI BRK-WF-01"),
        new("sh-breaker-blewifi-01", "Автоматический выключатель BLE + Wi-Fi", "Tuya", "switch", "Автомат", "Энергия", ["BLE+Wi-Fi"], "Tuya BREAKER BLE+WIFI BRK-BW-01"),
        new("sh-breaker-zigbee-01", "Автоматический выключатель Zigbee", "Tuya", "switch", "Автомат", "Энергия", ["Zigbee"], "Tuya BREAKER ZIGBEE BRK-ZB-01"),
        new("sh-breaker-4g-01", "Автоматический выключатель 4G", "Tuya", "switch", "Автомат", "Энергия", ["4G"], "Tuya BREAKER 4G BRK-4G-01"),
        new("sh-breaker-nbiot-01", "Автоматический выключатель NB-IoT", "Tuya", "switch", "Автомат", "Энергия", ["NB-IoT"], "Tuya BREAKER NB-IOT BRK-NB-01"),

        // Энергия — счетчики электроэнергии
        new("sh-meter-power-ble-01", "Умный счетчик электроэнергии BLE", "Tuya", "sensor", "Счетчик электроэнергии", "Энергия", ["BLE"], "Tuya POWER METER BLE PWR-BLE-01"),
        new("sh-meter-power-wifi-01", "Умный счетчик электроэнергии Wi-Fi", "Tuya", "sensor", "Счетчик электроэнергии", "Энергия", ["Wi-Fi"], "Tuya POWER METER WIFI PWR-WF-01"),
        new("sh-meter-power-blewifi-01", "Умный счетчик электроэнергии BLE + Wi-Fi", "Tuya", "sensor", "Счетчик электроэнергии", "Энергия", ["BLE+Wi-Fi"], "Tuya POWER METER BLE+WIFI PWR-BW-01"),
        new("sh-meter-power-zigbee-01", "Умный счетчик электроэнергии Zigbee", "Tuya", "sensor", "Счетчик электроэнергии", "Энергия", ["Zigbee"], "Tuya POWER METER ZIGBEE PWR-ZB-01"),
        new("sh-meter-power-4g-01", "Умный счетчик электроэнергии 4G", "Tuya", "sensor", "Счетчик электроэнергии", "Энергия", ["4G"], "Tuya POWER METER 4G PWR-4G-01"),
        new("sh-meter-power-nbiot-01", "Умный счетчик электроэнергии NB-IoT", "Tuya", "sensor", "Счетчик электроэнергии", "Энергия", ["NB-IoT"], "Tuya POWER METER NB-IOT PWR-NB-01"),

        // Энергия — счетчики воды
        new("sh-meter-water-ble-01", "Умный счетчик воды BLE", "Tuya", "sensor", "Счетчик воды", "Энергия", ["BLE"], "Tuya WATER METER BLE WTR-BLE-01"),
        new("sh-meter-water-wifi-01", "Умный счетчик воды Wi-Fi", "Tuya", "sensor", "Счетчик воды", "Энергия", ["Wi-Fi"], "Tuya WATER METER WIFI WTR-WF-01"),
        new("sh-meter-water-blewifi-01", "Умный счетчик воды BLE + Wi-Fi", "Tuya", "sensor", "Счетчик воды", "Энергия", ["BLE+Wi-Fi"], "Tuya WATER METER BLE+WIFI WTR-BW-01"),
        new("sh-meter-water-zigbee-01", "Умный счетчик воды Zigbee", "Tuya", "sensor", "Счетчик воды", "Энергия", ["Zigbee"], "Tuya WATER METER ZIGBEE WTR-ZB-01"),
        new("sh-meter-water-4g-01", "Умный счетчик воды 4G", "Tuya", "sensor", "Счетчик воды", "Энергия", ["4G"], "Tuya WATER METER 4G WTR-4G-01"),
        new("sh-meter-water-nbiot-01", "Умный счетчик воды NB-IoT", "Tuya", "sensor", "Счетчик воды", "Энергия", ["NB-IoT"], "Tuya WATER METER NB-IOT WTR-NB-01"),

        // Энергия — счетчики газа
        new("sh-meter-gas-ble-01", "Умный счетчик газа BLE", "Tuya", "sensor", "Счетчик газа", "Энергия", ["BLE"], "Tuya GAS METER BLE GAS-BLE-01"),
        new("sh-meter-gas-wifi-01", "Умный счетчик газа Wi-Fi", "Tuya", "sensor", "Счетчик газа", "Энергия", ["Wi-Fi"], "Tuya GAS METER WIFI GAS-WF-01"),
        new("sh-meter-gas-blewifi-01", "Умный счетчик газа BLE + Wi-Fi", "Tuya", "sensor", "Счетчик газа", "Энергия", ["BLE+Wi-Fi"], "Tuya GAS METER BLE+WIFI GAS-BW-01"),
        new("sh-meter-gas-zigbee-01", "Умный счетчик газа Zigbee", "Tuya", "sensor", "Счетчик газа", "Энергия", ["Zigbee"], "Tuya GAS METER ZIGBEE GAS-ZB-01"),
        new("sh-meter-gas-4g-01", "Умный счетчик газа 4G", "Tuya", "sensor", "Счетчик газа", "Энергия", ["4G"], "Tuya GAS METER 4G GAS-4G-01"),
        new("sh-meter-gas-nbiot-01", "Умный счетчик газа NB-IoT", "Tuya", "sensor", "Счетчик газа", "Энергия", ["NB-IoT"], "Tuya GAS METER NB-IOT GAS-NB-01"),

        // Безопасность
        new("sh-camera-01", "IP-камера 2 Мп Wi-Fi", "TP-Link", "camera", "Камера", "Камеры", ["Wi-Fi", "MIC", "IR", "NV"], "TP-Link CAMERA C200"),
        new("sh-camera-02", "IP-камера 4 Мп Wi-Fi", "Reolink", "camera", "Камера", "Камеры", ["Wi-Fi", "NMIC", "IR", "NV"], "Reolink CAMERA RLC-410"),
        new("sh-camera-03", "IP-камера 2 Мп PoE", "Hikvision", "camera", "Камера", "Камеры", ["PoE", "MIC", "IR", "NV"], "Hikvision CAMERA DS-2CD1023"),
        new("sh-camera-04", "PTZ-камера 4G", "Dahua", "camera", "Камера", "Камеры", ["4G", "MIC", "IR", "NV", "PTZ"], "Dahua CAMERA SD-4G-PTZ"),
        new("sh-camera-05", "Купольная камера Wi-Fi", "Ezviz", "camera", "Камера", "Камеры", ["Wi-Fi", "NMIC", "IR"], "Ezviz CAMERA C6N"),
        new("sh-camera-06", "Уличная камера Wi-Fi", "Imou", "camera", "Камера", "Камеры", ["Wi-Fi", "MIC", "IR", "NV", "IP66"], "Imou CAMERA IPC-F22"),
        new("sh-lock-01", "Умный замок BLE + Wi-Fi", "TTlock", "lock", "Замок", "Безопасность", ["BLE", "Wi-Fi"], "TTlock SMART LOCK TLK-01"),
        new("sh-window-01", "Датчик открытия окна Wi-Fi", "Tuya", "window", "Окно", "Безопасность", ["Wi-Fi"], "Tuya WINDOW SENSOR WND-WF-01"),
        new("sh-flood-sensor-01", "Датчик затопления", "Tuya", "sensor", "Затопление", "Безопасность", ["Wi-Fi"], "Tuya FLOOD SENSOR FLD-WF-01"),
        new("sh-smoke-detector-01", "Детектор дыма", "Tuya", "sensor", "Дым", "Безопасность", ["Wi-Fi"], "Tuya SMOKE DETECTOR SMK-WF-01"),
        new("sh-gas-detector-01", "Детектор газа", "Tuya", "sensor", "Газ", "Безопасность", ["Wi-Fi"], "Tuya GAS DETECTOR GASD-WF-01"),

        // Прочее
        new("sh-curtain-01", "Электрокарниз / шторы Wi-Fi", "Dooya", "curtain", "Шторы", "Прочее", ["Wi-Fi"], "Dooya CURTAIN DR-01"),
    }.AsReadOnly();

    public static Product? TryGet(string? sku) =>
        string.IsNullOrWhiteSpace(sku)
            ? null
            : All.FirstOrDefault(p => p.Sku.Equals(sku.Trim(), StringComparison.OrdinalIgnoreCase));

    public static Product? TryMatchTuyaCloud(string? tuyaProductId, string? tuyaProductName)
    {
        static string Normalize(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return string.Empty;
            var chars = s.Trim().ToLowerInvariant().Where(ch => char.IsLetterOrDigit(ch)).ToArray();
            return new string(chars);
        }

        var normalizedName = Normalize(tuyaProductName);
        if (normalizedName.Length > 0)
        {
            var byExactName = All.FirstOrDefault(p =>
                (p.TuyaProductNameHints != null && p.TuyaProductNameHints.Any(h => Normalize(h) == normalizedName)) ||
                (!string.IsNullOrWhiteSpace(p.TuyaProductLabel) && Normalize(p.TuyaProductLabel) == normalizedName));
            if (byExactName != null) return byExactName;
        }

        return null;
    }

    public static Product? TryMatchTuyaLan(string? tuyaProductKey)
    {
        if (string.IsNullOrWhiteSpace(tuyaProductKey)) return null;
        var key = tuyaProductKey.Trim();
        return All.FirstOrDefault(p =>
            p.TuyaProductKeys != null &&
            p.TuyaProductKeys.Any(k => string.Equals(k, key, StringComparison.OrdinalIgnoreCase)));
    }

    /// <summary>Базовая модель Tuya по типу, если точный product_name/product_id не сопоставился.</summary>
    public static Product? TryGetTuyaDefaultByType(string? type)
    {
        var t = (type ?? "").Trim().ToLowerInvariant();
        if (t == "light")
            return TryGet("sh-light-tuya-01");
        if (t == "outlet")
            return TryGet("sh-outlet-tuya-01");
        return null;
    }
}
