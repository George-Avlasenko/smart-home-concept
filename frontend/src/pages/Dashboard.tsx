import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Grid,
  Button,
  Slider,
  Tooltip,
  FormControlLabel,
  Checkbox,
  IconButton,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  Autocomplete,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import WindowIcon from '@mui/icons-material/Window';
import AirIcon from '@mui/icons-material/Air';
import OpacityIcon from '@mui/icons-material/Opacity';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../api/client';
import { DeviceStatus } from '../types';
import type { Device, House } from '../types';
import { GlassTopBar } from '../components/GlassTopBar';
import { Toast } from '../components/Toast';
import { useSSE } from '../hooks/useSSE';
import { useAuth } from '../context/AuthContext';
import { useSelectedHouse } from '../context/SelectedHouseContext';
import intercomImg from '../assets/2.jpg';
import intercomVideo4 from '../assets/4.mp4';
import { WeatherIcon } from 'weather-react-icons';
import 'weather-react-icons/lib/css/weather-icons.css';
import 'weather-react-icons/lib/css/weather-icons-wind.css';

export interface HouseSensorSummaryPoint {
  recordedAt: string;
  temp?: number;
  humidity?: number;
  co2?: number;
}

export const Dashboard = () => {
  const theme = useTheme();
  const narrowChart = useMediaQuery(theme.breakpoints.down(1021));
  const legendLower748 = useMediaQuery('(max-width:748px)');
  const hideLegend690 = useMediaQuery('(max-width:690px)');
  const veryNarrowChart = useMediaQuery(theme.breakpoints.down(673));
  const stackedLayout = useMediaQuery('(max-width:1471px)');
  const weatherCompact = useMediaQuery('(max-width:720px)');
  const weatherVeryCompact = useMediaQuery('(max-width:520px)');
  const { user, logout } = useAuth();
  const { selectedHouseId, setSelectedHouseId } = useSelectedHouse();
  const [now, setNow] = useState(() => new Date());

  const weatherIconBoxSize = weatherVeryCompact ? 64 : weatherCompact ? 72 : 88;
  const weatherIconFontSize = weatherVeryCompact ? 36 : weatherCompact ? 44 : 56;
  const windIconFontSize = weatherVeryCompact ? 32 : weatherCompact ? 40 : 56;

  // Скролл только когда блоки в колонку (узкий экран). При 1200+ (блоки в ряд) — без скролла.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (!stackedLayout) {
      const prevHtml = html.style.overflow;
      const prevBody = body.style.overflow;
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
      return () => {
        html.style.overflow = prevHtml;
        body.style.overflow = prevBody;
      };
    }
  }, [stackedLayout]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  type WeatherApiResponse = {
    hasLocation?: boolean;
    city?: string | null;
    temperatureC?: number;
    clouds?: number;
    isNight?: boolean;
    isRain?: boolean;
    isSnow?: boolean;
    windSpeedMps?: number;
    windLevel?: number;
    summary?: string | null;
  };

  const [weatherApi, setWeatherApi] = useState<WeatherApiResponse | null>(null);
  const [weatherCity, setWeatherCity] = useState<string>('');
  const [weatherLoadError, setWeatherLoadError] = useState<string | null>(null);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationDraft, setLocationDraft] = useState('');

  const CITY_OPTIONS = useMemo(
    () => ['Минск', 'Москва', 'Варшава', 'Киев', 'Вильнюс', 'Рига', 'Таллин', 'Париж'],
    []
  );

  const weatherHasLocation = !!weatherApi?.hasLocation;
  const weatherLocationEntered = weatherCity.trim().length > 0;
  const weatherTempC = weatherApi?.temperatureC ?? 0;

  // Загружаем город для выбранного дома.
  useEffect(() => {
    if (selectedHouseId == null) {
      setWeatherCity('');
      return;
    }
    try {
      const key = `weatherCity:${selectedHouseId}`;
      const stored = window.localStorage.getItem(key) ?? '';
      setWeatherCity(stored);
      setLocationDraft(stored);
    } catch {
      setWeatherCity('');
      setLocationDraft('');
    }
  }, [selectedHouseId]);

  // Запрашиваем погоду по выбранному городу.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (selectedHouseId == null) return;
      try {
        const res = await api.get<any[]>('/weatherforecast', {
          params: { houseId: selectedHouseId, city: weatherCity || undefined },
        });
        const first = Array.isArray(res.data) && res.data.length ? res.data[0] : null;
        if (!cancelled) {
          setWeatherApi(first as WeatherApiResponse | null);
          setWeatherLoadError(null);
        }
      } catch {
        // Если не удалось — показываем заглушку (0°C + подсказка про местоположение).
        if (!cancelled) {
          setWeatherApi({ hasLocation: false, temperatureC: 0 });
          setWeatherLoadError('Не удалось получить погоду по выбранному городу.');
        }
      }
    };

    load();
    const t = window.setInterval(load, 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [selectedHouseId, weatherCity]);

  const handleOpenLocationDialog = () => {
    setLocationDraft(weatherCity);
    setWeatherLoadError(null);
    setLocationDialogOpen(true);
  };

  const handleCloseLocationDialog = () => {
    setLocationDialogOpen(false);
  };

  const handleSaveLocationDialog = () => {
    if (selectedHouseId == null) return;
    const v = locationDraft.trim();
    const key = `weatherCity:${selectedHouseId}`;
    try {
      if (v) window.localStorage.setItem(key, v);
      else window.localStorage.removeItem(key);
    } catch {
      // Если localStorage недоступен — просто закрываем диалог.
    }
    setWeatherCity(v);
    setWeatherLoadError(null);
    setLocationDialogOpen(false);
  };

  // Применяем город при вводе (с debounce), НЕ закрывая диалог.
  useEffect(() => {
    if (selectedHouseId == null) return;

    const v = locationDraft.trim();
    const t = window.setTimeout(() => {
      setWeatherCity(v);
      setWeatherLoadError(null);
      const key = `weatherCity:${selectedHouseId}`;
      try {
        if (v) window.localStorage.setItem(key, v);
        else window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }, 500);

    return () => window.clearTimeout(t);
  }, [locationDraft, selectedHouseId]);

  const [devices, setDevices] = useState<Device[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [houseLightsBrightness, setHouseLightsBrightness] = useState(100);
  const [houseLightsWarmth, setHouseLightsWarmth] = useState(4200);
  const [lightsWarmthExpanded, setLightsWarmthExpanded] = useState(false);
  const [intercomOpen, setIntercomOpen] = useState(false);
  const [intercomBusy, setIntercomBusy] = useState(false);
  const intercomVideoRef = useRef<HTMLVideoElement | null>(null);

  const fetchDevices = async () => {
    try {
      const response = await api.get<Device[]>('/devices');
      setDevices(response.data);
    } catch (err) {
      setError('Не удалось загрузить список устройств');
    } finally {
      setLoading(false);
    }
  };

  const fetchHouses = async () => {
    try {
      const response = await api.get<House[]>('/houses');
      const list = response.data || [];
      setHouses(list);
      if (list.length > 0 && selectedHouseId === null) {
        setSelectedHouseId(list[0].houseId);
      }
      // Пользователь demo без домов — создаём демо-дом
      if (user?.username === 'demo' && list.length === 0) {
        try {
          await api.post('/emulator/ensure-demo-house');
          const retry = await api.get<House[]>('/houses');
          const retryList = retry.data || [];
          setHouses(retryList);
          if (retryList.length > 0 && selectedHouseId === null) {
            setSelectedHouseId(retryList[0].houseId);
          }
          fetchDevices();
        } catch (_) { /* ignore */ }
      }
    } catch (err) {
      console.error('Failed to fetch houses:', err);
      setHouses([]);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchHouses();
  }, [user?.username]);

  // Если под demo и домов нет — создаём демо-дом (на случай если fetchHouses отработал до восстановления user)
  useEffect(() => {
    if (user?.username !== 'demo' || houses.length > 0 || loading) return;
    (async () => {
      try {
        await api.post('/emulator/ensure-demo-house');
        const res = await api.get<House[]>('/houses');
        const list = res.data || [];
        setHouses(list);
        if (list.length > 0) setSelectedHouseId(list[0].houseId);
        fetchDevices();
      } catch (_) { /* ignore */ }
    })();
  }, [user?.username, houses.length, loading]);

  const selectedHouseIndex = useMemo(() => {
    const idx = houses.findIndex(h => h.houseId === selectedHouseId);
    return idx >= 0 ? idx : 0;
  }, [houses, selectedHouseId]);

  const houseItems = useMemo(() => 
    houses.map(h => ({ id: h.houseId, label: h.address })),
    [houses]
  );

  const selectedHouse = useMemo(
    () => (selectedHouseId != null ? houses.find(h => h.houseId === selectedHouseId) ?? null : null),
    [houses, selectedHouseId]
  );

  useSSE({
    enabled: !loading,
    onMessage: async (event) => {
      switch (event.type) {
        case 'device.status.updated':
          setDevices(prev => prev.map(d => 
            d.deviceId === event.data.deviceId 
              ? { ...d, status: event.data.status } 
              : d
          ));
          break;
        
        case 'device.settings.updated':
          setDevices(prev => prev.map(d => 
            d.deviceId === event.data.deviceId 
              ? { ...d, settings: { ...d.settings, ...event.data.settings } } 
              : d
          ));
          break;
        case 'house.outdoor_updated':
          if (event.data?.houseId != null)
            setDevices(prev => prev.map(d => d.houseId === event.data.houseId ? { ...d, outdoorTemp: event.data.outdoorTemp, outdoorHumidity: event.data.outdoorHumidity, outdoorCo2: event.data.outdoorCo2 } : d));
          break;
        
        case 'device.created':
        case 'device.updated':
          fetchDevices();
          break;
        
        case 'device.deleted':
          setDevices(prev => prev.filter(d => d.deviceId !== event.data.deviceId));
          break;
        
        case 'room.created':
        case 'room.updated':
        case 'room.deleted':
        case 'house.created':
        case 'house.updated':
        case 'house.deleted':
          fetchDevices();
          fetchHouses();
          break;
        
        default:
          break;
      }
    },
    onError: (error) => {
      console.error('SSE error:', error);
    },
  });

  const handleToggleDevice = async (id: number, newStatus: DeviceStatus) => {
    try {
      await api.put(`/devices/${id}/status`, { status: newStatus });
      fetchDevices();
    } catch (err) {
      setError('Ошибка при изменении статуса');
      fetchDevices();
    }
  };

  const handleSettingsChange = async (id: number, newSettings: Record<string, any>) => {
    try {
      await api.put(`/devices/${id}/settings`, { settings: newSettings });
      fetchDevices();
    } catch (err) {
      console.error(err);
      fetchDevices();
    }
  };

  const fetchDevicesRef = useRef(fetchDevices);
  const fetchHousesRef = useRef(fetchHouses);
  fetchDevicesRef.current = fetchDevices;
  fetchHousesRef.current = fetchHouses;
  useEffect(() => {
    if (!selectedHouseId) return;
    const t = setInterval(() => { fetchDevicesRef.current(); fetchHousesRef.current(); }, 10000);
    return () => clearInterval(t);
  }, [selectedHouseId]);

  const updateHouseClimate = async (patch: { useTempRange?: boolean; minTemp?: number; maxTemp?: number }) => {
    if (selectedHouseId == null) return;
    try {
      await api.put(`/houses/${selectedHouseId}`, patch);
      setHouses(prev => prev.map(h => h.houseId === selectedHouseId ? { ...h, ...patch } : h));
    } catch (e) {
      setError('Не удалось сохранить настройки климата');
    }
  };

  // Устройства выбранного дома (все комнаты дома)
  const houseDevices = useMemo(() => {
    if (selectedHouseId === null) return [];
    return devices.filter(d => d.houseId === selectedHouseId);
  }, [devices, selectedHouseId]);

  const houseThermostats = useMemo(() => houseDevices.filter(d => d.type.toLowerCase() === 'thermostat'), [houseDevices]);
  const houseSensors = useMemo(() => houseDevices.filter(d => d.type.toLowerCase() === 'sensor'), [houseDevices]);
  const houseWindows = useMemo(() => houseDevices.filter(d => d.type.toLowerCase() === 'window'), [houseDevices]);
  const houseLocks = useMemo(() => houseDevices.filter(d => d.type.toLowerCase() === 'lock'), [houseDevices]);
  const doorState = useMemo(() => {
    if (houseLocks.length === 0) {
      return { text: 'Дверь: —', isLocked: false };
    }
    const isLocked = houseLocks.some(l => String(l.status).toLowerCase() === 'active');
    return { text: isLocked ? 'Дверь заблокирована' : 'Дверь открыта', isLocked };
  }, [houseLocks]);

  const weatherVisual = useMemo(() => {
    const hour = now.getHours();
    const isNight = weatherApi?.isNight ?? (hour < 6 || hour >= 20);

    const make = (clouds: 0 | 1 | 2 | 3) => ({
      kind: clouds === 0 ? 'clear' : `cloud${clouds}`,
      label: 'Погода',
      iconColor: isNight ? 'rgba(170,190,255,0.95)' : 'rgba(255,210,120,0.95)',
      icon: (
        <WeatherIcon
          iconId={clouds === 0 ? 800 : clouds === 1 ? 801 : clouds === 2 ? 802 : 803}
          name="owm"
          night={isNight}
        />
      ),
    });

    if (weatherApi?.hasLocation) {
      if (weatherApi.isSnow) {
        return {
          kind: 'snow',
          label: 'Снег',
          iconColor: 'rgba(160,220,255,0.9)',
          icon: <WeatherIcon iconId={600} name="owm" night={isNight} />,
        };
      }

      if (weatherApi.isRain) {
        return {
          kind: 'rain',
          label: 'Дождь',
          iconColor: 'rgba(120,180,255,0.95)',
          icon: <WeatherIcon iconId={500} name="owm" night={isNight} />,
        };
      }

      const cloudsApi = weatherApi.clouds ?? 0;
      const clouds = (cloudsApi < 0 ? 0 : cloudsApi > 3 ? 3 : cloudsApi) as 0 | 1 | 2 | 3;
      return make(clouds);
    }

    // Если локации нет — показываем базовую картинку (а рядом будет подсказка).
    return make(0);
  }, [now, weatherApi]);

  const windVisual = useMemo(() => {
    const wind = weatherApi?.windSpeedMps ?? 0;
    const levelRaw = weatherApi?.windLevel ?? (wind < 4.0 ? 1 : wind < 8.0 ? 2 : 3);
    const level = (levelRaw < 1 ? 1 : levelRaw > 3 ? 3 : levelRaw) as 1 | 2 | 3;
    return { wind, level, label: 'Ветер' };
  }, [weatherApi]);
  const houseLights = useMemo(() => houseDevices.filter(d => d.type.toLowerCase() === 'light'), [houseDevices]);
  const houseVentilation = useMemo(() => houseDevices.filter(d => d.type.toLowerCase() === 'ventilation'), [houseDevices]);
  const houseHumidifiers = useMemo(() => houseDevices.filter(d => d.type.toLowerCase() === 'humidifier'), [houseDevices]);

  const [houseChartDays, setHouseChartDays] = useState(1);
  const [houseChartData, setHouseChartData] = useState<HouseSensorSummaryPoint[]>([]);
  const [houseChartLoading, setHouseChartLoading] = useState(false);

  const loadHouseChart = useCallback(async (silent = false) => {
    if (!selectedHouseId || houseSensors.length === 0) {
      setHouseChartData([]);
      if (!silent) setHouseChartLoading(false);
      return;
    }

    if (!silent) setHouseChartLoading(true);
    try {
      const res = await api.get<HouseSensorSummaryPoint[]>(
        `/sensorreadings/house/${selectedHouseId}?days=${houseChartDays}&maxPoints=500`
      );
      setHouseChartData(Array.isArray(res.data) ? res.data : []);
    } catch {
      if (!silent) setHouseChartData([]);
    } finally {
      if (!silent) setHouseChartLoading(false);
    }
  }, [selectedHouseId, houseChartDays, houseSensors.length]);

  useEffect(() => {
    void loadHouseChart(false);
  }, [loadHouseChart]);

  useEffect(() => {
    if (!selectedHouseId || houseSensors.length === 0) return;
    const timer = setInterval(() => {
      void loadHouseChart(true);
    }, 10000);
    return () => clearInterval(timer);
  }, [selectedHouseId, houseSensors.length, loadHouseChart]);

  const houseChartSeries = useMemo(() => {
    const sane = (v: unknown, lo: number, hi: number): number | undefined => {
      if (v == null) return undefined;
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n) || n < lo || n > hi || Math.abs(n) > 1e6) return undefined;
      return n;
    };
    const rec = (p: HouseSensorSummaryPoint) => p.recordedAt ?? (p as unknown as { RecordedAt?: string }).RecordedAt;
    const t = (p: HouseSensorSummaryPoint) => p.temp ?? (p as unknown as { Temp?: number }).Temp;
    const h = (p: HouseSensorSummaryPoint) => p.humidity ?? (p as unknown as { Humidity?: number }).Humidity;
    const c = (p: HouseSensorSummaryPoint) => p.co2 ?? (p as unknown as { Co2?: number }).Co2;
    const sorted = [...houseChartData].sort(
      (a, b) => new Date(rec(a)).getTime() - new Date(rec(b)).getTime()
    );
    const bucketMs = 60 * 1000;
    const byBucket = new Map<number, { sumT: number; sumH: number; sumC: number; countT: number; countH: number; countC: number }>();
    sorted.forEach((p) => {
      const ts = new Date(rec(p)).getTime();
      if (!Number.isFinite(ts)) return;
      const key = Math.floor(ts / bucketMs) * bucketMs;
      const prev = byBucket.get(key) ?? { sumT: 0, sumH: 0, sumC: 0, countT: 0, countH: 0, countC: 0 };
      const tv = sane(t(p), -30, 60);
      const hv = sane(h(p), 0, 100);
      const cv = sane(c(p), 0, 10000);
      if (tv != null) { prev.sumT += tv; prev.countT += 1; }
      if (hv != null) { prev.sumH += hv; prev.countH += 1; }
      if (cv != null) { prev.sumC += cv; prev.countC += 1; }
      byBucket.set(key, prev);
    });

    const points = Array.from(byBucket.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, v]) => ({
        ts,
        time: new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        temp: v.countT > 0 ? v.sumT / v.countT : undefined,
        humidity: v.countH > 0 ? v.sumH / v.countH : undefined,
        co2: v.countC > 0 ? v.sumC / v.countC : undefined,
      }));

    // Легкое сглаживание скользящим средним (окно 3 точки), как в графике датчика.
    const smooth = <T extends number | undefined>(arr: T[], i: number): number | undefined => {
      let sum = 0;
      let cnt = 0;
      for (let k = Math.max(0, i - 1); k <= Math.min(arr.length - 1, i + 1); k += 1) {
        const v = arr[k];
        if (v != null) { sum += Number(v); cnt += 1; }
      }
      return cnt > 0 ? sum / cnt : undefined;
    };
    const tempArr = points.map((p) => p.temp);
    const humArr = points.map((p) => p.humidity);
    const co2Arr = points.map((p) => p.co2);

    const round1 = (x: number | undefined) => x != null ? Math.round(x * 10) / 10 : undefined;
    const round0 = (x: number | undefined) => x != null ? Math.round(x) : undefined;
    return points.map((p, i) => ({
      time: p.time,
      temp: round1(smooth(tempArr, i)),
      humidity: round1(smooth(humArr, i)),
      co2: round0(smooth(co2Arr, i)),
    }));
  }, [houseChartData]);

  const houseChartDomains = useMemo(() => {
    const temps: number[] = [];
    const hums: number[] = [];
    const co2s: number[] = [];
    houseChartSeries.forEach((p) => {
      if (p.temp != null && Number.isFinite(p.temp) && p.temp >= -30 && p.temp <= 60) temps.push(p.temp);
      if (p.humidity != null && Number.isFinite(p.humidity) && p.humidity >= 0 && p.humidity <= 100) hums.push(p.humidity);
      if (p.co2 != null && Number.isFinite(p.co2) && p.co2 >= 0 && p.co2 <= 10000) co2s.push(p.co2);
    });
    const padDomain = (a: number, b: number, clampLo: number, clampHi: number, decimals: number): [number, number] => {
      const lo = Math.max(clampLo, Math.min(clampHi, Math.min(a, b)));
      const hi = Math.max(clampLo, Math.min(clampHi, Math.max(a, b)));
      const d = (hi - lo) || 1;
      const round = (x: number) => Math.round(x * 10 ** decimals) / 10 ** decimals;
      return [round(lo - d * 0.08), round(hi + d * 0.08)];
    };
    const tMin = temps.length ? Math.min(...temps) : 18;
    const tMax = temps.length ? Math.max(...temps) : 26;
    const tClampLo = Math.min(0, tMin - 2);
    const tClampHi = Math.max(30, tMax + 2);
    const hMin = hums.length ? Math.min(...hums) : 30;
    const hMax = hums.length ? Math.max(...hums) : 70;
    const cMin = co2s.length ? Math.min(...co2s) : 400;
    const cMax = co2s.length ? Math.max(...co2s) : 800;
    return {
      temp: padDomain(tMin, tMax, tClampLo, tClampHi, 1),
      humidity: padDomain(hMin, hMax, 0, 100, 1),
      co2: padDomain(cMin, cMax, 300, 5000, 0),
    };
  }, [houseChartSeries]);

  const houseMainTemp = useMemo(() => {
    const t = houseThermostats[0]?.settings?.targetTemp ?? 22;
    return t;
  }, [houseThermostats]);

  const setHouseTempAll = (temp: number) => {
    houseThermostats.forEach(dev => {
      handleSettingsChange(dev.deviceId, { ...dev.settings, targetTemp: temp });
    });
  };

  const setHouseWindowsAll = (mode: string) => {
    houseWindows.forEach(dev => {
      handleSettingsChange(dev.deviceId, { ...dev.settings, mode });
      if (mode === 'closed') handleToggleDevice(dev.deviceId, DeviceStatus.Inactive);
      else handleToggleDevice(dev.deviceId, DeviceStatus.Active);
    });
  };

  const setHouseLightsAll = (on: boolean, brightness?: number) => {
    houseLights.forEach(dev => {
      handleToggleDevice(dev.deviceId, on ? DeviceStatus.Active : DeviceStatus.Inactive);
      if (on && brightness != null) handleSettingsChange(dev.deviceId, { ...dev.settings, brightness });
    });
  };

  const handlePowerOff = async () => {
    if (selectedHouseId === null) return;
    const msg =
      'Отключить электричество в доме?\n\n' +
      'Будет выключено питание всего дома. ' +
      'Двери и окна будут автоматически разблокированы.\n\nПродолжить?';
    if (!window.confirm(msg)) return;
    const logEntry = { event: 'main_power_off', houseId: selectedHouseId, at: new Date().toISOString() };
    try {
      localStorage.setItem('powerOffLog', JSON.stringify(logEntry));
    } catch (_) {}

    // Перед переходом на страницу отключения выставляем "открыто":
    // - замки: снимаем блокировку (Inactive)
    // - окна: включаем режим opened и соответствующий статус
    try {
      await Promise.all(
        houseLocks.map(d =>
          api.put(`/devices/${d.deviceId}/status`, { status: DeviceStatus.Inactive })
        )
      );

      await Promise.all(
        houseWindows.map(d =>
          api.put(`/devices/${d.deviceId}/settings`, { settings: { ...d.settings, mode: 'opened' } })
        )
      );

      await Promise.all(
        houseWindows.map(d =>
          api.put(`/devices/${d.deviceId}/status`, { status: DeviceStatus.Active })
        )
      );
    } catch (_) {
      // Если API временно недоступен — всё равно покажем экран отключения
    }

    sessionStorage.clear();
    window.location.href = '/power-off';
  };

  const handleIntercomOpen = () => {
    setIntercomOpen(true);
    // Открытие делается кликом, поэтому воспроизведение со звуком обычно разрешается браузером.
    // Если не разрешит — просто не будет звука, но интерфейс откроется.
    setTimeout(() => {
      intercomVideoRef.current?.play().catch(() => {
        /* ignore */
      });
    }, 0);
  };

  const handleIntercomCancel = () => setIntercomOpen(false);

  const handleIntercomOpenDoor = async () => {
    if (houseLocks.length === 0) return;
    setIntercomBusy(true);
    try {
      await Promise.all(
        houseLocks.map(d =>
          api.put(`/devices/${d.deviceId}/status`, { status: DeviceStatus.Inactive })
        )
      );
      fetchDevices();
    } finally {
      setIntercomBusy(false);
    }
  };

  const handleIntercomCloseDoor = async () => {
    if (houseLocks.length === 0) return;
    setIntercomBusy(true);
    try {
      await Promise.all(
        houseLocks.map(d =>
          api.put(`/devices/${d.deviceId}/status`, { status: DeviceStatus.Active })
        )
      );
      fetchDevices();
    } finally {
      setIntercomBusy(false);
    }
  };

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        sx={{ minHeight: '100dvh', position: 'relative', zIndex: 1 }}
      >
        <CircularProgress sx={{ color: '#F08B5C' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      position: 'relative',
      minHeight: '100svh',
      display: 'flex',
      flexDirection: 'column',
      overflow: stackedLayout ? 'visible' : 'hidden',
    }}>
      {/* Размытый фон */}
      {/* Верхняя панель — выбор дома */}
      <GlassTopBar
        items={houseItems}
        selectedIndex={selectedHouseIndex}
        onItemChange={(index) => setSelectedHouseId(houses[index]?.houseId ?? null)}
        onAddClick={() => window.location.href = '/admin/houses'}
        onLogout={logout}
      />

      {/* Контейнер под топбаром: отступы делаем padding'ом, чтобы не появлялся скролл из-за margin */}
      <Box sx={{ flex: stackedLayout ? '1 1 auto' : 1, minHeight: 0, p: 4, boxSizing: 'border-box' }}>
        {/* Основной контент - стеклянная панель */}
        <Box
          sx={{
            flex: stackedLayout ? '0 0 auto' : 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            p: 4,
            boxSizing: 'border-box',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 8,
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
            position: 'relative',
            zIndex: 1,
            overflow: stackedLayout ? 'visible' : 'hidden',
          }}
        >
        <Toast
          open={!!error}
          message={error}
          severity="error"
          onClose={() => setError('')}
        />

        {houses.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
              Нет доступных домов
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 2, display: 'block' }}>
              {user?.username === 'demo'
                ? 'Демо-дом создаётся… Если не появился — обновите страницу.'
                : 'Добавьте дом в разделе «Управление домами» или войдите как demo для демо-дома.'}
            </Typography>
            <Button
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}
              onClick={() => window.location.href = '/admin/houses'}
            >
              Управление домами
            </Button>
          </Box>
        ) : selectedHouseId === null ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Выберите дом выше
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flex: stackedLayout ? '1 1 auto' : 1,
              minHeight: 0,
              overflow: 'visible',
            }}
          >
          {/* Верхняя часть: 35% высоты (при двух колонках); при stacked — по контенту */}
          <Box sx={{ flex: '0 0 30%', minHeight: 0, display: 'flex', flexDirection: 'column', mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch', flexWrap: stackedLayout ? 'wrap' : 'nowrap' }}>
              {/* Свет — 1 */}
              <Box sx={{ flex: '1 1 0', minWidth: 140, maxWidth: '100%' }}>
                {houseLights.length > 0 ? (
                  <Box sx={{ p: 2, height: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)' }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>Свет</Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', whiteSpace: 'nowrap', minWidth: { xs: 74, sm: 88 } }}
                        onClick={() => setHouseLightsAll(true, houseLightsBrightness)}
                      >
                        Вкл все
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', whiteSpace: 'nowrap', minWidth: { xs: 74, sm: 88 } }}
                        onClick={() => setHouseLightsAll(false)}
                      >
                        Выкл все
                      </Button>
                    </Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Яркость: {houseLightsBrightness}%</Typography>
                    <Slider size="small" value={houseLightsBrightness} min={0} max={100} sx={{ color: '#F08B5C' }}
                      onChange={(_, v) => {
                        const b = v as number;
                        setHouseLightsBrightness(b);
                        houseLights.forEach(dev => handleSettingsChange(dev.deviceId, { ...dev.settings, brightness: b }));
                      }}
                      valueLabelDisplay="auto" />
                    <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                        Теплота света: {houseLightsWarmth}K
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => setLightsWarmthExpanded((p) => !p)}
                        sx={{ color: 'rgba(255,255,255,0.7)', p: 0.25 }}
                      >
                        {lightsWarmthExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </IconButton>
                    </Box>
                    <Collapse in={lightsWarmthExpanded} unmountOnExit>
                      <Slider
                        size="small"
                        value={houseLightsWarmth}
                        min={2700}
                        max={6500}
                        step={50}
                        sx={{ color: '#F08B5C' }}
                        onChange={(_, v) => {
                          const k = v as number;
                          setHouseLightsWarmth(k);
                          houseLights.forEach(dev => handleSettingsChange(dev.deviceId, { ...dev.settings, colorTempKelvin: k }));
                        }}
                        valueLabelDisplay="auto"
                      />
                    </Collapse>
                  </Box>
                ) : (
                  <Box sx={{ p: 2, height: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>Свет</Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>Нет светильников</Typography>
                  </Box>
                )}
              </Box>
              {/* Отключение — 1 */}
              <Box sx={{ flex: '1 1 0', minWidth: 140, maxWidth: '100%' }}>
                <Box sx={{ p: 2, height: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 1 }}>Щиток</Typography>
                  <Button size="small" variant="outlined" sx={{ borderColor: 'rgba(255,100,100,0.6)', color: '#ff8a8a' }} onClick={handlePowerOff}>
                    Отключить электричество
                  </Button>
                </Box>
              </Box>
              {/* Домофон у двери — 1 */}
              <Box sx={{ flex: '1 1 0', minWidth: 140, maxWidth: '100%' }}>
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={handleIntercomOpen}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleIntercomOpen();
                  }}
                  sx={{
                    p: 2,
                    height: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: 'rgba(240, 139, 92, 0.5)',
                      boxShadow: '0 0 20px rgba(240, 139, 92, 0.22)',
                    },
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 1 }}>
                    Камера у двери
                  </Typography>

                  <Box
                    sx={{
                      width: '100%',
                      aspectRatio: '16/9',
                      borderRadius: 1,
                      overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(0,0,0,0.4)',
                      mb: 1,
                    }}
                  >
                    <Box
                      component="img"
                      src={intercomImg}
                      alt="Камера у двери"
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.92 }}
                    />
                  </Box>

                    {/* подпись убрана: оставляем только картинку и управление */}
                </Box>
              </Box>
              {/* Погода на улице — 2 */}
              <Box sx={{ flex: '2 2 0', minWidth: 180, maxWidth: '100%' }}>
                <Box sx={{ p: 2, height: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 1 }}>Погода на улице</Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: weatherCompact ? 'column' : 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: weatherCompact ? 1.5 : 2,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: weatherCompact ? 'center' : 'flex-start',
                        flex: '1 1 220px',
                        minWidth: 0,
                      }}
                    >
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: 800,
                          color: 'rgba(255,255,255,0.95)',
                          lineHeight: 1,
                          fontSize: 'clamp(44px, 4.7vw, 64px)',
                        }}
                      >
                        {now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                      <Box
                        sx={{
                          width: '100%',
                          height: 1,
                          my: 0.7,
                          background: 'rgba(255,255,255,0.12)',
                        }}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#F08B5C', lineHeight: 1.05 }}>
                          {weatherHasLocation ? `${weatherTempC.toFixed(1)}°C` : '0.0°C'}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={handleOpenLocationDialog}
                          sx={{
                            ml: 0.2,
                            color: 'rgba(255,255,255,0.8)',
                            border: '1px solid rgba(255,255,255,0.18)',
                            background: 'rgba(0,0,0,0.15)',
                            '&:hover': { background: 'rgba(255,255,255,0.08)' },
                          }}
                        >
                          <LocationOnIcon fontSize="small" />
                        </IconButton>
                        {weatherCity.trim() ? (
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>
                            {weatherCity.trim()}
                          </Typography>
                        ) : null}
                      </Box>

                      {!weatherLocationEntered && (
                        <Typography
                          variant="caption"
                          sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mt: 0.5 }}
                        >
                          Чтобы отслеживать погоду добавьте местоположение
                        </Typography>
                      )}

                      {!!weatherLocationEntered && !weatherHasLocation && !!weatherLoadError && (
                        <Typography
                          variant="caption"
                          sx={{ color: 'rgba(255,107,53,0.9)', display: 'block', mt: 0.5 }}
                        >
                          {weatherLoadError}
                        </Typography>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8, flex: '0 0 auto' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: weatherCompact ? 1.2 : 2, flexWrap: 'nowrap' }}>
                        {/* Ветер слева от погоды */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4 }}>
                          <Box
                            sx={{
                              width: weatherIconBoxSize,
                              height: weatherIconBoxSize,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Box sx={{ fontSize: windIconFontSize, color: 'rgba(190,220,255,0.95)' }}>
                              <i className={`wi wi-wind-beaufort-${windVisual.level}`} aria-hidden="true" />
                            </Box>
                          </Box>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                            {windVisual.wind.toFixed(1)} м/с
                          </Typography>
                        </Box>

                        {/* Погода справа */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4 }}>
                          <Box
                            sx={{
                              width: weatherIconBoxSize,
                              height: weatherIconBoxSize,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: weatherIconFontSize,
                              color: weatherVisual.iconColor,
                            }}
                          >
                            {weatherVisual.icon}
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>

          <Dialog
            open={intercomOpen}
            onClose={handleIntercomCancel}
            maxWidth="md"
            fullWidth
            PaperProps={{
              sx: {
                background: 'rgba(36, 42, 72, 0.96)',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 2,
              },
            }}
          >
              <DialogTitle sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                Камера у двери
              </DialogTitle>
            <DialogContent sx={{ pt: 1 }}>
              <Box
                sx={{
                  width: '100%',
                  aspectRatio: '16/9',
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(0,0,0,0.4)',
                }}
              >
                <video
                  src={intercomVideo4}
                  autoPlay
                  loop
                  playsInline
                  aria-label="Видео с домофона"
                  ref={intercomVideoRef}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.95 }}
                />
              </Box>
              <Box
                sx={{
                  mt: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1.5,
                  border: `1px solid ${
                    doorState.isLocked ? 'rgba(255,107,53,0.55)' : 'rgba(78,205,196,0.45)'
                  }`,
                  background: `rgba(255,255,255,0.12)`,
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                }}
              >
                {doorState.isLocked ? (
                  <LockIcon fontSize="small" sx={{ color: '#FF6B6B' }} />
                ) : (
                  <LockOpenIcon fontSize="small" sx={{ color: '#4ECDC4' }} />
                )}
                <Typography
                  variant="body2"
                  sx={{
                    color: doorState.isLocked ? '#FF6B6B' : '#4ECDC4',
                    fontWeight: 700,
                  }}
                >
                  {doorState.text}
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={handleIntercomCancel} sx={{ color: 'rgba(255,255,255,0.85)' }}>
                Отмена
              </Button>
              <Button
                variant="outlined"
                onClick={handleIntercomOpenDoor}
                disabled={houseLocks.length === 0 || intercomBusy}
                sx={{ borderColor: 'rgba(78,205,196,0.6)', color: '#4ECDC4' }}
              >
                Открыть
              </Button>
              <Button
                variant="outlined"
                onClick={handleIntercomCloseDoor}
                disabled={houseLocks.length === 0 || intercomBusy}
                sx={{ borderColor: 'rgba(255,107,53,0.6)', color: '#FF6B6B' }}
              >
                Закрыть
              </Button>
            </DialogActions>
          </Dialog>

          {/* Диалог выбора города для погоды */}
          <Dialog
            open={locationDialogOpen}
            onClose={handleCloseLocationDialog}
            maxWidth="xs"
            fullWidth
            disableRestoreFocus
            PaperProps={{
              sx: {
                background: 'rgba(36, 42, 72, 0.96)',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 2,
              },
            }}
          >
            <DialogTitle sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
              Выберите местоположение
            </DialogTitle>
            <DialogContent sx={{ pt: 1 }}>
              <Autocomplete<string, false, false, true>
                freeSolo
                options={CITY_OPTIONS}
                inputValue={locationDraft}
                onInputChange={(_, v) => setLocationDraft(v)}
                onChange={(_, v) => {
                  if (!v) return;
                  setLocationDraft(v);
                  setWeatherLoadError(null);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    id="weather-city-input"
                    name="weather-city-input"
                    placeholder="Введите город"
                    size="small"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveLocationDialog();
                    }}
                    InputProps={{
                      ...params.InputProps,
                      style: { paddingTop: 12, paddingBottom: 12 },
                    }}
                    sx={{
                      '& .MuiInputBase-root': { color: '#fff' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                    }}
                  />
                )}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={handleCloseLocationDialog} sx={{ color: 'rgba(255,255,255,0.85)' }}>
                Отмена
              </Button>
              <Button
                variant="outlined"
                onClick={handleSaveLocationDialog}
                sx={{ borderColor: 'rgba(240,139,92,0.7)', color: '#F08B5C' }}
              >
                Сохранить
              </Button>
            </DialogActions>
          </Dialog>

          {/* Нижняя часть: 65% высоты; при ширине < lg блок «Климат и вентиляция» переносится вниз, контейнер может расти и скроллится вся область */}
          <Grid container spacing={2} sx={{ flex: '0 0 70%', minHeight: 200, alignItems: 'stretch', pb: 4, mt: 0 }}>
            <Grid item xs={12} lg={7} sx={{ display: 'flex', minHeight: 200, ...(stackedLayout && { minHeight: 240 }) }}>
              <Box sx={{ p: 2, width: '100%', minHeight: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1 }}>Средние по датчикам в доме</Typography>
                {houseSensors.length === 0 ? (
                  <Box sx={{ py: 6, px: 2, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', maxWidth: 320, mx: 'auto' }}>
                      В доме нет датчиков. Добавьте датчики в разделе устройств — тогда здесь появится график средних показаний (температура, влажность, CO₂).
                    </Typography>
                    <Button size="small" sx={{ mt: 2, color: '#F08B5C' }} onClick={() => window.location.href = '/devices'}>К устройствам</Button>
                  </Box>
                ) : houseChartLoading ? (
                  <Box display="flex" justifyContent="center" alignItems="center" minHeight={220}><CircularProgress size={32} sx={{ color: '#F08B5C' }} /></Box>
                ) : houseChartSeries.length === 0 ? (
                  <>
                    <Box sx={{ alignSelf: 'flex-start', mb: 1 }}>
                      <FormControl size="small" sx={{ minWidth: 120 }} variant="outlined">
                        <InputLabel id="dashboard-chart-period-empty-label" sx={{ color: 'rgba(255,255,255,0.7)' }}>Период</InputLabel>
                        <Select
                          id="dashboard-chart-period-empty-select"
                          labelId="dashboard-chart-period-empty-label"
                          value={houseChartDays}
                          label="Период"
                          onChange={(e) => setHouseChartDays(Number(e.target.value))}
                          sx={{ color: 'rgba(255,255,255,0.9)' }}
                        >
                          <MenuItem value={1}>1 день</MenuItem>
                          <MenuItem value={7}>7 дней</MenuItem>
                          <MenuItem value={30}>30 дней</MenuItem>
                          <MenuItem value={90}>90 дней</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        Нет данных за выбранный период. Запустите эмулятор или подождите накопления показаний.
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <>
                    <Box sx={{ alignSelf: 'flex-start', mb: 1 }}>
                      <FormControl size="small" sx={{ minWidth: 120 }} variant="outlined">
                        <InputLabel id="dashboard-chart-period-data-label" sx={{ color: 'rgba(255,255,255,0.7)' }}>Период</InputLabel>
                        <Select id="dashboard-chart-period-data-select" labelId="dashboard-chart-period-data-label" value={houseChartDays} label="Период" onChange={(e) => setHouseChartDays(Number(e.target.value))} sx={{ color: 'rgba(255,255,255,0.9)' }}>
                          <MenuItem value={1}>1 день</MenuItem>
                          <MenuItem value={7}>7 дней</MenuItem>
                          <MenuItem value={30}>30 дней</MenuItem>
                          <MenuItem value={90}>90 дней</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    <Box
                      sx={{
                        width: '100%',
                        height: 'clamp(220px, 40vh, 762px)',
                        '& .recharts-wrapper': { outline: 'none' },
                        '& [tabindex]': { outline: 'none' },
                      }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={houseChartSeries} margin={{ top: 8, right: 40, left: 20, bottom: 8 }} syncId="houseChart">
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                          <XAxis dataKey="time" stroke="rgba(255,255,255,0.7)" tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 10 }} />
                          <YAxis yAxisId="temp" orientation="left" stroke="rgba(255,255,255,0.7)" tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 10 }} domain={houseChartDomains.temp} tickFormatter={(v) => Number.isFinite(v) ? String(Math.round(Number(v) * 100) / 100) : ''} />
                          <YAxis yAxisId="humidity" orientation="right" stroke="rgba(255,255,255,0.7)" tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 10 }} domain={houseChartDomains.humidity} width={28} tickFormatter={(v) => Number.isFinite(v) ? String(Math.round(Number(v) * 100) / 100) : ''} />
                          <YAxis yAxisId="co2" orientation="right" stroke="rgba(255,255,255,0.7)" tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 10 }} domain={houseChartDomains.co2} width={32} tickFormatter={(v) => Number.isFinite(v) ? String(Math.round(Number(v))) : ''} />
                          <RechartsTooltip contentStyle={{ background: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }} labelStyle={{ color: 'rgba(255,255,255,0.9)' }} />
                          {!hideLegend690 && (
                            <Legend
                              verticalAlign="bottom"
                              wrapperStyle={{
                                color: 'rgba(255,255,255,0.9)',
                                marginTop: 3,
                              }}
                              content={({ payload }) => {
                              const order = ['temp', 'co2', 'humidity'];
                              const sorted = (payload ?? []).slice().sort((a, b) => order.indexOf(String(a.dataKey)) - order.indexOf(String(b.dataKey)));
                              return sorted.length ? <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>{sorted.map((e) => <span key={String(e.value)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 14, height: 2, backgroundColor: e.color }} /><span style={{ color: 'rgba(255,255,255,0.9)' }}>{e.value}</span></span>)}</div> : null;
                            }}
                            />
                          )}
                          <Line yAxisId="co2" type="monotone" dataKey="co2" name="CO₂ ppm" stroke="#81C784" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                          <Line yAxisId="humidity" type="monotone" dataKey="humidity" name="Влажность %" stroke="#64B5F6" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                          <Line yAxisId="temp" type="monotone" dataKey="temp" name="Температура °C" stroke="#F08B5C" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  </>
                )}
              </Box>
            </Grid>

            {/* Справа (или снизу при ширине < lg): климат и вентиляция — при переносе вниз блок растёт по контенту, скролл у всей области */}
            <Grid item xs={12} lg={5} sx={{ display: 'flex', minHeight: stackedLayout ? 320 : 200 }}>
              <Box sx={{ p: 2, width: '100%', minHeight: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 2, flexShrink: 0 }}>Климат и вентиляция</Typography>
                <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>

                  {/* Кондиционер */}
                  <Grid item xs={12} sm={6} sx={{ display: 'flex' }}>
                    <Box sx={{ p: 1.5, minHeight: 160, flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <AcUnitIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.7)' }} />
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', flex: 1 }}>Кондиционер</Typography>
                        {houseThermostats.length === 0 ? (
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Нет в доме</Typography>
                        ) : (
                          <>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={houseThermostats.some(d => d.status === 'active')}
                                  onChange={(_, checked) => houseThermostats.forEach(d => handleToggleDevice(d.deviceId, checked ? DeviceStatus.Active : DeviceStatus.Inactive))}
                                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#F08B5C' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#F08B5C' } }}
                                />
                              }
                              label={<Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>Вкл</Typography>}
                            />
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={selectedHouse?.useTempRange ?? false}
                                  onChange={(_, checked) => updateHouseClimate({ useTempRange: checked })}
                                  sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#F08B5C' } }}
                                />
                              }
                              label={<Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>По диапазону</Typography>}
                            />
                          </>
                        )}
                      </Box>
                      {houseThermostats.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          {(selectedHouse?.useTempRange ?? false) ? (
                            <>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28 }}>Мин</Typography>
                                <Slider size="small" value={selectedHouse?.minTemp ?? 18} min={14} max={28} step={1} sx={{ color: '#F08B5C', flex: 1 }}
                                  onChange={(_, v) => updateHouseClimate({ minTemp: v as number })} valueLabelDisplay="auto" />
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28 }}>Макс</Typography>
                                <Slider size="small" value={selectedHouse?.maxTemp ?? 24} min={16} max={30} step={1} sx={{ color: '#F08B5C', flex: 1 }}
                                  onChange={(_, v) => updateHouseClimate({ maxTemp: v as number })} valueLabelDisplay="auto" />
                              </Box>
                            </>
                          ) : (
                            <>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Целевая °C</Typography>
                              <Slider size="small" value={houseMainTemp} min={16} max={30} step={0.5} sx={{ color: '#F08B5C', mt: 0.5 }}
                                onChange={(_, v) => setHouseTempAll(v as number)} valueLabelDisplay="auto" />
                            </>
                          )}
                        </Box>
                      )}
                    </Box>
                  </Grid>
                  {/* Окна */}
                  <Grid item xs={12} sm={6} sx={{ display: 'flex' }}>
                    <Box sx={{ p: 1.5, minHeight: 160, flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WindowIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.7)' }} />
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>Окна</Typography>
                        {houseWindows.length === 0 && <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Нет в доме</Typography>}
                      </Box>
                      {houseWindows.length > 0 && (
                        <Box sx={{ mt: 'auto', pt: 1, width: '100%' }}>
                          <FormControl fullWidth size="small">
                            <InputLabel id="dashboard-house-windows-mode-label" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                              Режим
                            </InputLabel>
                            <Select
                              id="dashboard-house-windows-mode-select"
                              labelId="dashboard-house-windows-mode-label"
                              value={houseWindows.every(d => d.status !== 'active') ? 'closed' : houseWindows.some(d => d.settings?.mode === 'opened') ? 'opened' : 'tilted'}
                              onChange={(e) => setHouseWindowsAll(e.target.value as string)}
                              label="Режим"
                              sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' } }}
                            >
                              <MenuItem value="closed">Закрыто</MenuItem>
                              <MenuItem value="tilted">Проветривание</MenuItem>
                              <MenuItem value="opened">Открыто</MenuItem>
                            </Select>
                          </FormControl>

                          <Box sx={{ mt: 1 }}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={!!houseWindows[0]?.settings?.autoCloseInRain}
                                  onChange={(_, checked) => houseWindows.forEach(d => handleSettingsChange(d.deviceId, { ...d.settings, autoCloseInRain: checked }))}
                                  sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#F08B5C' } }}
                                />
                              }
                              label={<Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>Автозакрытие в дождь</Typography>}
                            />

                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
                                Порог дождя:
                              </Typography>
                              <Slider
                                size="small"
                                value={houseWindows[0]?.settings?.rainHumidityThreshold ?? 85}
                                min={60}
                                max={99}
                                step={1}
                                disabled={!houseWindows[0]?.settings?.autoCloseInRain}
                                onChange={(_, v) => houseWindows.forEach(d => handleSettingsChange(d.deviceId, { ...d.settings, rainHumidityThreshold: v as number }))}
                                valueLabelDisplay="auto"
                                sx={{ flex: 1, color: '#F08B5C', '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)' } }}
                              />
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', minWidth: 36 }}>
                                {houseWindows[0]?.settings?.rainHumidityThreshold ?? 85}%
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Grid>
                  {/* Вентиляция: вкл/выкл + диапазон CO₂ */}
                  <Grid item xs={12} sm={6} sx={{ display: 'flex' }}>
                    <Box sx={{ p: 1.5, minHeight: 160, flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <AirIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.7)' }} />
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', flex: 1 }}>Вентиляция&nbsp;&nbsp;</Typography>
                        {houseVentilation.length === 0 ? (
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Нет в доме</Typography>
                        ) : (
                          <FormControlLabel
                            control={
                              <Switch
                                checked={houseVentilation.some(d => d.status === 'active')}
                                onChange={(_, checked) => houseVentilation.forEach(d => handleToggleDevice(d.deviceId, checked ? DeviceStatus.Active : DeviceStatus.Inactive))}
                                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#F08B5C' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#F08B5C' } }}
                              />
                            }
                            label={<Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>Вкл</Typography>}
                          />
                        )}
                      </Box>
                      {houseVentilation.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={!!(houseVentilation[0]?.settings?.useCo2Range)}
                                onChange={(_, checked) => houseVentilation.forEach(d => handleSettingsChange(d.deviceId, { ...d.settings, useCo2Range: checked }))}
                                sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#F08B5C' } }}
                              />
                            }
                            label={<Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>Авто по диапазону CO₂</Typography>}
                          />
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28 }}>Мин</Typography>
                            <Slider size="small" value={houseVentilation[0]?.settings?.co2Min ?? 600} min={400} max={1500} step={100} sx={{ color: '#F08B5C', flex: 1 }}
                              disabled={!houseVentilation[0]?.settings?.useCo2Range}
                              onChange={(_, v) => houseVentilation.forEach(d => handleSettingsChange(d.deviceId, { ...d.settings, co2Min: v as number }))} valueLabelDisplay="auto" />
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28 }}>Макс</Typography>
                            <Slider size="small" value={houseVentilation[0]?.settings?.co2Max ?? 1200} min={800} max={2000} step={100} sx={{ color: '#F08B5C', flex: 1 }}
                              disabled={!houseVentilation[0]?.settings?.useCo2Range}
                              onChange={(_, v) => houseVentilation.forEach(d => handleSettingsChange(d.deviceId, { ...d.settings, co2Max: v as number }))} valueLabelDisplay="auto" />
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Grid>
                  {/* Увлажнитель: вкл/выкл + цель или диапазон влажности */}
                  <Grid item xs={12} sm={6} sx={{ display: 'flex' }}>
                    <Box sx={{ p: 1.5, minHeight: 160, flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <OpacityIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.7)' }} />
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', flex: 1 }}>Увлажнитель</Typography>
                        {houseHumidifiers.length === 0 ? (
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Нет в доме</Typography>
                        ) : (
                          <FormControlLabel
                            control={
                              <Switch
                                checked={houseHumidifiers.some(d => d.status === 'active')}
                                onChange={(_, checked) => houseHumidifiers.forEach(d => handleToggleDevice(d.deviceId, checked ? DeviceStatus.Active : DeviceStatus.Inactive))}
                                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#F08B5C' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#F08B5C' } }}
                              />
                            }
                            label={<Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>Вкл</Typography>}
                          />
                        )}
                      </Box>
                      {houseHumidifiers.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={!!(houseHumidifiers[0]?.settings?.useHumidityRange)}
                                onChange={(_, checked) => houseHumidifiers.forEach(d => handleSettingsChange(d.deviceId, { ...d.settings, useHumidityRange: checked }))}
                                sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#F08B5C' } }}
                              />
                            }
                            label={<Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>По диапазону</Typography>}
                          />
                          {houseHumidifiers[0]?.settings?.useHumidityRange ? (
                            <>
                              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28 }}>Мин</Typography>
                                <Slider size="small" value={houseHumidifiers[0]?.settings?.minHumidity ?? 30} min={20} max={70} step={5} sx={{ color: '#F08B5C', flex: 1 }}
                                  onChange={(_, v) => houseHumidifiers.forEach(d => handleSettingsChange(d.deviceId, { ...d.settings, minHumidity: v as number }))} valueLabelDisplay="auto" />
                              </Box>
                              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28 }}>Макс</Typography>
                                <Slider size="small" value={houseHumidifiers[0]?.settings?.maxHumidity ?? 60} min={30} max={85} step={5} sx={{ color: '#F08B5C', flex: 1 }}
                                  onChange={(_, v) => houseHumidifiers.forEach(d => handleSettingsChange(d.deviceId, { ...d.settings, maxHumidity: v as number }))} valueLabelDisplay="auto" />
                              </Box>
                            </>
                          ) : (
                            <>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Цель %</Typography>
                              <Slider size="small" value={houseHumidifiers[0]?.settings?.targetHumidity ?? 50} min={30} max={80} step={5} sx={{ color: '#F08B5C', mt: 0.5 }}
                                onChange={(_, v) => houseHumidifiers.forEach(d => handleSettingsChange(d.deviceId, { ...d.settings, targetHumidity: v as number }))}
                                valueLabelDisplay="auto" />
                            </>
                          )}
                        </Box>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>
          </Box>
        )}
        </Box>
      </Box>
    </Box>
  );
};
