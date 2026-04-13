import React, { useCallback, useEffect, useState } from 'react';
import {
  Typography,
  Stack,
  Alert,
  TextField,
  Button,
  Divider,
  Box,
  CircularProgress,
  Slider,
  MenuItem,
  FormControl,
  Select,
} from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { GlassPage } from '../components/GlassPage';
import { tuyaApi } from '../api/tuyaClient';
import { api } from '../api/client';
import type { House, Room } from '../types';
import { useSelectedHouse } from '../context/SelectedHouseContext';

const TUYA_LAB_LS = 'tuyaLightExperiment.v1';

function readTuyaLabSaved(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(TUYA_LAB_LS);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}

/**
 * Экспериментальная страница: локальное управление лампой Tuya через микросервис TinyTuya.
 */
export const TuyaLightExperiment: React.FC = () => {
  const saved = readTuyaLabSaved();
  const [deviceId, setDeviceId] = useState(() => (saved?.deviceId != null ? String(saved.deviceId) : 'bf15e903a13bfc1e84mw8j'));
  const [localKey, setLocalKey] = useState(() =>
    saved?.localKey != null ? String(saved.localKey) : "mQ!)@9h{{cdd`*L^",
  );
  const [ipHint, setIpHint] = useState(() => (saved?.ipHint != null ? String(saved.ipHint) : '192.168.31.38'));
  const [version, setVersion] = useState(() => (saved?.version != null ? String(saved.version) : '3.5'));
  const [dpsSwitch, setDpsSwitch] = useState(() => (saved?.dpsSwitch != null ? String(saved.dpsSwitch) : '20'));
  const [brightnessPercent, setBrightnessPercent] = useState(() =>
    typeof saved?.brightnessPercent === 'number' ? saved.brightnessPercent : 30,
  );
  const [temperatureKelvin, setTemperatureKelvin] = useState(() =>
    typeof saved?.temperatureKelvin === 'number' ? saved.temperatureKelvin : 4200,
  );
  const [hue, setHue] = useState(() => (typeof saved?.hue === 'number' ? saved.hue : 0));
  const [satPercent, setSatPercent] = useState(() => (typeof saved?.satPercent === 'number' ? saved.satPercent : 100));
  const [valPercent, setValPercent] = useState(() => (typeof saved?.valPercent === 'number' ? saved.valPercent : 100));
  const [loading, setLoading] = useState(false);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [houses, setHouses] = useState<House[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | ''>(() =>
    typeof saved?.selectedRoomId === 'number' ? saved.selectedRoomId : '',
  );
  const [newDeviceName, setNewDeviceName] = useState(() =>
    saved?.newDeviceName != null ? String(saved.newDeviceName) : 'Tuya Лампа',
  );
  const [addingToSystem, setAddingToSystem] = useState(false);
  const [refreshingLocalKey, setRefreshingLocalKey] = useState(false);
  const { selectedHouseId } = useSelectedHouse();

  useEffect(() => {
    const t = window.setTimeout(() => {
      localStorage.setItem(
        TUYA_LAB_LS,
        JSON.stringify({
          deviceId,
          localKey,
          ipHint,
          version,
          dpsSwitch,
          brightnessPercent,
          temperatureKelvin,
          hue,
          satPercent,
          valPercent,
          selectedRoomId,
          newDeviceName,
        }),
      );
    }, 500);
    return () => window.clearTimeout(t);
  }, [
    deviceId,
    localKey,
    ipHint,
    version,
    dpsSwitch,
    brightnessPercent,
    temperatureKelvin,
    hue,
    satPercent,
    valPercent,
    selectedRoomId,
    newDeviceName,
  ]);

  const payload = () => {
    const dps = parseInt(dpsSwitch, 10);
    return {
      device_id: deviceId.trim(),
      local_key: localKey,
      ip: ipHint.trim(),
      version: version.trim() || '3.3',
      dps_switch: Number.isFinite(dps) && dps >= 1 ? dps : 1,
    };
  };

  const checkHealth = useCallback(async () => {
    setError('');
    setResult('');
    try {
      const { data } = await tuyaApi.get<{ ok?: boolean }>('/health');
      setHealthOk(!!data?.ok);
      setResult(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      setHealthOk(false);
      setError(
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Сервис /tuya недоступен. Запусти tuya-service (порт 5055) или docker compose.'
      );
    }
  }, []);

  const readStatus = async () => {
    setLoading(true);
    setError('');
    setResult('');
    try {
      const { data } = await tuyaApi.post('/v1/status', payload());
      setResult(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(ax.response?.data?.detail || ax.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const doSwitch = async (on: boolean) => {
    setLoading(true);
    setError('');
    setResult('');
    try {
      const { data } = await tuyaApi.post('/v1/switch', { ...payload(), on });
      setResult(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(ax.response?.data?.detail || ax.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const setBrightnessValue = async () => {
    setLoading(true);
    setError('');
    setResult('');
    try {
      const { data } = await tuyaApi.post('/v1/brightness', { ...payload(), percent: brightnessPercent });
      setResult(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(ax.response?.data?.detail || ax.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const setTemperatureValue = async () => {
    setLoading(true);
    setError('');
    setResult('');
    try {
      const { data } = await tuyaApi.post('/v1/temperature', { ...payload(), kelvin: temperatureKelvin });
      setResult(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(ax.response?.data?.detail || ax.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const setColorValue = async () => {
    setLoading(true);
    setError('');
    setResult('');
    try {
      const { data } = await tuyaApi.post('/v1/color', {
        ...payload(),
        h: hue,
        s_percent: satPercent,
        v_percent: valPercent,
      });
      setResult(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(ax.response?.data?.detail || ax.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const canControl = deviceId.trim() && localKey && ipHint.trim();
  const canAddToSystem = !!selectedHouseId && !!selectedRoomId && newDeviceName.trim().length > 0 && canControl;

  const refreshLocalKeyFromCloud = async () => {
    if (!deviceId.trim()) {
      setError('Сначала укажи Device ID');
      return;
    }
    setRefreshingLocalKey(true);
    setError('');
    setResult('');
    try {
      const { data } = await api.post<{ ok?: boolean; localKey?: string }>('/devices/tuya/refresh-local-key', {
        hardwareDeviceId: deviceId.trim(),
      });
      const lk = String(data?.localKey ?? '').trim();
      if (!lk) throw new Error('Сервер не вернул local key');
      setLocalKey(lk);
      setResult('Local key обновлён из Tuya Cloud и подставлен в поле.');
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string; title?: string; message?: string } | string }; message?: string };
      const backendMsg =
        typeof ax.response?.data === 'string'
          ? ax.response.data
          : ax.response?.data?.detail || ax.response?.data?.title || ax.response?.data?.message;
      setError(backendMsg || ax.message || String(e));
    } finally {
      setRefreshingLocalKey(false);
    }
  };

  React.useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get<House[]>('/houses');
        setHouses(Array.isArray(data) ? data : []);
      } catch {
        setHouses([]);
      }
    };
    load();
  }, []);

  React.useEffect(() => {
    const loadRooms = async () => {
      if (!selectedHouseId) {
        setRooms([]);
        setSelectedRoomId('');
        return;
      }
      try {
        const { data } = await api.get<Room[]>(`/houses/${selectedHouseId}/rooms`);
        const list = Array.isArray(data) ? data : [];
        setRooms(list);
        setSelectedRoomId((prev) => (prev && list.some((r) => r.roomId === prev) ? prev : (list[0]?.roomId ?? '')));
      } catch {
        setRooms([]);
        setSelectedRoomId('');
      }
    };
    loadRooms();
  }, [selectedHouseId]);

  const addLampToSystem = async () => {
    if (!canAddToSystem) return;
    setAddingToSystem(true);
    setError('');
    setResult('');
    try {
      const hardwareDeviceId = deviceId.trim();
      const created = await api.post('/devices', {
        roomId: selectedRoomId,
        productSku: 'sh-light-tuya-01',
        name: newDeviceName.trim(),
        hardwareDeviceId,
        ip: ipHint.trim(),
      });
      const deviceIdCreated = created?.data?.deviceId;
      if (deviceIdCreated) {
        await api.put(`/devices/${deviceIdCreated}/settings`, {
          settings: {
            tuya: {
              enabled: true,
              deviceId: deviceId.trim(),
              localKey: localKey,
              ip: ipHint.trim(),
              version: version.trim() || '3.5',
              dpsSwitch: Number.parseInt(dpsSwitch, 10) || 20,
            },
          },
        });
      }
      setResult('Лампа добавлена в систему. Теперь она доступна на дашборде как обычный девайс типа light.');
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string; title?: string } | string }; message?: string };
      const backendMsg =
        typeof ax.response?.data === 'string'
          ? ax.response.data
          : ax.response?.data?.detail || ax.response?.data?.title;
      setError(backendMsg || ax.message || String(e));
    } finally {
      setAddingToSystem(false);
    }
  };

  return (
    <GlassPage>
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <LightbulbIcon sx={{ fontSize: 36, color: '#F08B5C' }} />
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Лампа Tuya
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <Button variant="outlined" onClick={checkHealth} size="small">
            Проверить сервис
          </Button>
          {healthOk === true && <Typography variant="caption" sx={{ color: '#4ECDC4' }}>tuya-service OK</Typography>}
          {healthOk === false && <Typography variant="caption" sx={{ color: '#FF6B6B' }}>tuya-service недоступен</Typography>}
        </Stack>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Параметры лампы
        </Typography>
        <Stack spacing={2} sx={{ maxWidth: 520 }}>
          <TextField
            id="tuya-device-id"
            label="Device ID"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            fullWidth
            autoComplete="off"
            placeholder="bfxxxxxxxx..."
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ sm: 'flex-start' }}>
            <TextField
              id="tuya-local-key"
              label="Local key"
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              fullWidth
              autoComplete="off"
              inputProps={{ spellCheck: false }}
            />
            <Button
              variant="outlined"
              onClick={refreshLocalKeyFromCloud}
              disabled={refreshingLocalKey || !deviceId.trim()}
              sx={{ minWidth: { sm: 190 }, whiteSpace: 'nowrap', height: 40 }}
            >
              {refreshingLocalKey ? 'Обновление...' : 'Обновить local key'}
            </Button>
          </Stack>
          <TextField
            id="tuya-ip"
            label="IP лампы в LAN"
            value={ipHint}
            onChange={(e) => setIpHint(e.target.value)}
            fullWidth
            placeholder="192.168.1.42"
            autoComplete="off"
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              id="tuya-version"
              label="Версия протокола"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              fullWidth
              placeholder="3.3"
            />
            <TextField
              id="tuya-dps-switch"
              label="DPS для вкл/выкл"
              value={dpsSwitch}
              onChange={(e) => setDpsSwitch(e.target.value)}
              fullWidth
              placeholder="1"
            />
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <Button
              variant="contained"
              onClick={readStatus}
              disabled={!canControl || loading}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              Статус
            </Button>
            <Button variant="contained" color="success" onClick={() => doSwitch(true)} disabled={!canControl || loading}>
              Вкл
            </Button>
            <Button variant="contained" color="error" onClick={() => doSwitch(false)} disabled={!canControl || loading}>
              Выкл
            </Button>
          </Stack>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
          <Stack spacing={1}>
            <Typography variant="body2">Яркость: {brightnessPercent}%</Typography>
            <Slider
              value={brightnessPercent}
              min={1}
              max={100}
              step={1}
              valueLabelDisplay="auto"
              onChange={(_, value) => setBrightnessPercent(value as number)}
            />
            <Button variant="contained" onClick={setBrightnessValue} disabled={!canControl || loading} sx={{ alignSelf: 'flex-start' }}>
              Применить яркость
            </Button>
          </Stack>
          <Stack spacing={1}>
            <Typography variant="body2">Температура: {temperatureKelvin}K</Typography>
            <Slider
              value={temperatureKelvin}
              min={2700}
              max={6500}
              step={50}
              valueLabelDisplay="auto"
              onChange={(_, value) => setTemperatureKelvin(value as number)}
            />
            <Button variant="contained" onClick={setTemperatureValue} disabled={!canControl || loading} sx={{ alignSelf: 'flex-start' }}>
              Применить температуру
            </Button>
          </Stack>
          <Stack spacing={1}>
            <Typography variant="body2">Hue: {hue}</Typography>
            <Slider value={hue} min={0} max={360} step={1} valueLabelDisplay="auto" onChange={(_, value) => setHue(value as number)} />
            <Typography variant="body2">Saturation: {satPercent}%</Typography>
            <Slider value={satPercent} min={0} max={100} step={1} valueLabelDisplay="auto" onChange={(_, value) => setSatPercent(value as number)} />
            <Typography variant="body2">Value: {valPercent}%</Typography>
            <Slider value={valPercent} min={0} max={100} step={1} valueLabelDisplay="auto" onChange={(_, value) => setValPercent(value as number)} />
          </Stack>
          <Button variant="contained" onClick={setColorValue} disabled={!canControl || loading} sx={{ alignSelf: 'flex-start' }}>
            Применить RGB/HSV
          </Button>
        </Stack>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Добавить в девайсы дома
        </Typography>
        <Stack spacing={2} sx={{ maxWidth: 620 }}>
          <TextField
            id="tuya-device-name"
            label="Название устройства в системе"
            value={newDeviceName}
            onChange={(e) => setNewDeviceName(e.target.value)}
            fullWidth
            autoComplete="off"
          />
          <TextField
            id="tuya-house"
            label="Дом"
            value={houses.find((h) => h.houseId === selectedHouseId)?.address ?? ''}
            fullWidth
            disabled
          />
          <FormControl fullWidth disabled={!selectedHouseId || rooms.length === 0}>
            <Select
              id="tuya-room"
              name="tuya-room"
              displayEmpty
              inputProps={{ 'aria-label': 'Комната' }}
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(Number(e.target.value))}
            >
              <MenuItem value="" disabled>
                Комната
              </MenuItem>
              {rooms.map((r) => (
                <MenuItem key={r.roomId} value={r.roomId}>
                  {r.roomName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={addLampToSystem}
            disabled={!canAddToSystem || addingToSystem}
            startIcon={addingToSystem ? <CircularProgress size={18} color="inherit" /> : undefined}
            sx={{ alignSelf: 'flex-start' }}
          >
            Добавить лампу к остальным девайсам
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ bgcolor: 'rgba(211,47,47,0.25)', color: '#fff' }}>
            {error}
          </Alert>
        )}
        {result && (
          <Box
            component="pre"
            sx={{
              p: 2,
              borderRadius: 1,
              bgcolor: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.12)',
              overflow: 'auto',
              fontSize: 12,
              maxHeight: 320,
            }}
          >
            {result}
          </Box>
        )}
      </Stack>
    </GlassPage>
  );
};
