import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Alert, Stack, TextField, Button, Switch, FormControlLabel } from '@mui/material';
import { GlassPage } from '../components/GlassPage';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

type TuyaCloudVm = {
  enabled: boolean;
  accessId: string;
  /** Секрет из сервера — чтобы после обновления страницы поле не оставалось пустым. */
  accessSecret?: string;
  hasAccessSecret: boolean;
  region: string;
  isConfigured: boolean;
};

const STORAGE_KEY = 'tuyaCloudForm.v1';

function readSavedForm(): Partial<TuyaCloudVm> & { accessSecret?: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<TuyaCloudVm> & { accessSecret?: string };
  } catch {
    return null;
  }
}

export const Integrations: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const saved = readSavedForm();
  const [model, setModel] = useState<TuyaCloudVm>({
    enabled: typeof saved?.enabled === 'boolean' ? saved.enabled : false,
    accessId: (saved?.accessId && String(saved.accessId).trim()) || '',
    hasAccessSecret: false,
    region: (saved?.region && String(saved.region).trim()) || 'eu',
    isConfigured: false,
  });
  const [accessSecret, setAccessSecret] = useState(() => (saved?.accessSecret && String(saved.accessSecret)) || '');
  const skipNextPersist = useRef(false);

  useEffect(() => {
    const load = async () => {
      if (user?.role !== 'admin') {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get<TuyaCloudVm>('/integrations/tuya-cloud');
        let nextModel: TuyaCloudVm = { ...data };
        let nextSecret = data.accessSecret ?? '';

        const local = readSavedForm();
        if (local) {
          if (local.accessId?.trim()) nextModel = { ...nextModel, accessId: local.accessId.trim() };
          if (local.accessSecret?.trim() && !nextSecret.trim()) nextSecret = local.accessSecret.trim();
          if (local.region?.trim()) nextModel = { ...nextModel, region: local.region.trim() };
          if (typeof local.enabled === 'boolean') nextModel = { ...nextModel, enabled: local.enabled };
        }

        skipNextPersist.current = true;
        setModel(nextModel);
        setAccessSecret(nextSecret);

        if (!data.isConfigured && nextModel.accessId?.trim() && nextSecret?.trim()) {
          try {
            const auto = await api.put<{ isConfigured?: boolean; accessSecret?: string }>('/integrations/tuya-cloud', {
              enabled: true,
              accessId: nextModel.accessId.trim(),
              accessSecret: nextSecret.trim(),
              region: (nextModel.region || 'eu').trim(),
            });
            setModel((prev) => ({ ...prev, enabled: true, isConfigured: !!auto.data?.isConfigured }));
            if (auto.data?.accessSecret) setAccessSecret(String(auto.data.accessSecret));
          } catch {
            // keep form filled even if auto-apply failed
          }
        }
      } catch (e: any) {
        const d = e?.response?.data;
        setError(typeof d === 'string' ? d : d?.detail || d?.message || 'Не удалось загрузить интеграции');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user?.role]);

  useEffect(() => {
    if (loading || user?.role !== 'admin') return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          enabled: model.enabled,
          accessId: model.accessId,
          accessSecret,
          region: model.region,
        }),
      );
    }, 400);
    return () => window.clearTimeout(t);
  }, [loading, user?.role, model.enabled, model.accessId, model.region, accessSecret]);

  const save = async () => {
    setSaving(true);
    setError('');
    setOk('');
    try {
      const { data } = await api.put<{ isConfigured?: boolean; accessSecret?: string }>('/integrations/tuya-cloud', {
        enabled: model.enabled,
        accessId: model.accessId,
        accessSecret: accessSecret.trim() ? accessSecret.trim() : undefined,
        region: model.region,
      });
      setModel((prev) => ({
        ...prev,
        isConfigured: !!data?.isConfigured,
        hasAccessSecret: !!(data?.accessSecret && String(data.accessSecret).trim()),
      }));
      if (data?.accessSecret != null && String(data.accessSecret).length > 0) {
        setAccessSecret(String(data.accessSecret));
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          enabled: model.enabled,
          accessId: model.accessId,
          accessSecret: accessSecret,
          region: model.region,
        }),
      );
      setOk('Интеграция Tuya Cloud сохранена.');
    } catch (e: any) {
      const d = e?.response?.data;
      setError(typeof d === 'string' ? d : d?.detail || d?.message || 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <GlassPage>
        <Alert severity="error">Доступ только для администратора.</Alert>
      </GlassPage>
    );
  }

  return (
    <GlassPage>
      <Typography variant="h4" sx={{ color: '#fff', mb: 2 }}>Интеграции</Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', mb: 2 }}>
        Настройка Tuya Cloud для авто-получения local key и управления устройствами без ручного ввода локального ключа.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

      <Box sx={{ maxWidth: 700, p: 2, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)' }}>
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={model.enabled}
                onChange={(_, checked) => setModel((p) => ({ ...p, enabled: checked }))}
              />
            }
            label="Включить Tuya Cloud"
          />

          <TextField
            label="Access ID"
            value={model.accessId}
            onChange={(e) => setModel((p) => ({ ...p, accessId: e.target.value }))}
            fullWidth
            disabled={loading}
          />

          <TextField
            label="Access Secret"
            value={accessSecret}
            onChange={(e) => setAccessSecret(e.target.value)}
            fullWidth
            disabled={loading}
            type="text"
          />

          <TextField
            label="Region (eu/us/cn/in...)"
            value={model.region}
            onChange={(e) => setModel((p) => ({ ...p, region: e.target.value }))}
            fullWidth
            disabled={loading}
          />

          <Typography variant="caption" sx={{ color: model.isConfigured ? '#9be7a4' : '#ffb74d' }}>
            Статус: {model.isConfigured ? 'сконфигурировано' : 'не сконфигурировано'}
          </Typography>

          <Button variant="contained" onClick={save} disabled={loading || saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </Stack>
      </Box>
    </GlassPage>
  );
};
