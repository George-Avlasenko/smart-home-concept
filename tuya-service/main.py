"""
Микросервис для локального управления устройствами Tuya (TinyTuya).
Не ходит в облако Tuya — только TCP к лампе в той же LAN, где крутится процесс.
"""
from __future__ import annotations

import os
import time
import ipaddress
import re
from typing import Any, Callable

import tinytuya
import tinytuya.scanner as tuya_scanner
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


def _parse_version(v: str) -> float:
    v = (v or "3.3").strip()
    try:
        return float(v)
    except ValueError:
        return 3.3


class DeviceBase(BaseModel):
    device_id: str = Field(..., min_length=1, description="ID устройства (из приложения / tinytuya scan)")
    local_key: str = Field(..., min_length=1, description="Локальный ключ (не публикуй в git)")
    ip: str = Field(..., min_length=1, description="IP лампы в локальной сети, напр. 192.168.1.42")
    version: str = Field(default="3.3", description="Протокол: 3.1, 3.3, 3.4 и т.д.")
    dps_switch: int = Field(default=1, ge=1, le=255, description="Номер DPS для вкл/выкл (часто 1)")


class StatusRequest(DeviceBase):
    pass


class SwitchRequest(DeviceBase):
    on: bool = Field(..., description="True — включить, False — выключить")


class BrightnessRequest(DeviceBase):
    percent: int = Field(..., ge=1, le=100, description="Яркость в процентах 1..100")


class TemperatureRequest(DeviceBase):
    kelvin: int = Field(..., ge=2700, le=6500, description="Цветовая температура 2700..6500K")


class ColorRequest(DeviceBase):
    h: int = Field(..., ge=0, le=360, description="Hue 0..360")
    s_percent: int = Field(..., ge=0, le=100, description="Saturation 0..100%")
    v_percent: int = Field(..., ge=0, le=100, description="Value 0..100%")


def _device(req: DeviceBase) -> tinytuya.Device:
    d = tinytuya.Device(req.device_id, req.ip, req.local_key)
    d.set_version(_parse_version(req.version))
    if hasattr(d, "set_socketPersistent"):
        d.set_socketPersistent(False)
    if hasattr(d, "set_socketTimeout"):
        d.set_socketTimeout(4)
    return d


def _is_key_or_version_error(payload: Any) -> bool:
    if isinstance(payload, (tuple, list)):
        return any(_is_key_or_version_error(x) for x in payload)
    if isinstance(payload, dict):
        err = str(payload.get("Err", ""))
        msg = str(payload.get("Error", "")).lower()
        return err == "914" or "key" in msg or "version" in msg
    return False


def _with_version_fallback(req: DeviceBase, action: Callable[[tinytuya.Device], Any]) -> tuple[Any, float]:
    preferred = _parse_version(req.version)

    order = [preferred]
    for v in (3.3, 3.4, 3.5):
        if v not in order:
            order.append(v)

    last_payload: Any = None
    last_error: Exception | None = None

    for ver in order:
        try:
            d = _device(req)
            d.set_version(ver)
            payload = action(d)
            if _is_key_or_version_error(payload):
                last_payload = payload
                continue
            return payload, ver
        except Exception as e:
            last_error = e

    if last_error is not None:
        raise last_error
    raise HTTPException(
        status_code=502,
        detail=f"tinytuya error: key/version mismatch for all tried protocol versions. Last payload: {last_payload}",
    )


def _set_values(d: tinytuya.Device, values: dict[int, Any]) -> Any:
    # Предпочитаем атомарную отправку, чтобы не было эффекта "команда применяется на следующий запрос".
    if hasattr(d, "set_multiple_values"):
        return d.set_multiple_values(values)

    last = None
    for dps, value in values.items():
        last = d.set_value(dps, value)
    return last


def _encode_color_hsv(h: int, s: int, v: int) -> str:
    # Формат colour_data_v2 для большинства Tuya RGB-ламп: HHHHSSSSVVVV (hex, 4 символа на компонент)
    return f"{h:04x}{s:04x}{v:04x}"


def _percent_to_dps(percent: int) -> int:
    # Диапазон лампы: 10..1000
    return max(10, min(1000, round(10 + (percent / 100) * 990)))


def _kelvin_to_dps(kelvin: int) -> int:
    # 2700K -> 0, 6500K -> 1000
    return max(0, min(1000, round(((kelvin - 2700) / (6500 - 2700)) * 1000)))


def _percent_to_1000(percent: int) -> int:
    return max(0, min(1000, round((percent / 100) * 1000)))


app = FastAPI(
    title="Tuya LAN bridge",
    description="Локальное управление Tuya через TinyTuya (без Алисы/Маруся приложений)",
    version="0.1.0",
)

_origins = os.getenv("CORS_ORIGINS", "").strip()
if _origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in _origins.split(",") if o.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/health")
def health():
    return {"ok": True, "service": "tuya-lan"}


_IPV4_RE = re.compile(
    r"^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
)


def _is_ipv4(s: str) -> bool:
    s = (s or "").strip()
    if not _IPV4_RE.match(s):
        return False
    try:
        ipaddress.IPv4Address(s)
        return True
    except ValueError:
        return False


def _clean_want_ips(ips: list[str] | None) -> list[str] | None:
    out = []
    for x in ips or []:
        s = (x or "").strip()
        if _is_ipv4(s):
            out.append(s)
    return out or None


def _normalize_scan(scanned: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not scanned:
        return []
    devices: list[dict[str, Any]] = []
    for key, data in scanned.items():
        row = data if isinstance(data, dict) else {}
        k = str(key)
        ip = str(row.get("ip") or (k if _is_ipv4(k) else "")).strip()
        did = str(row.get("gwId") or row.get("id") or row.get("devId") or "").strip()
        if not did and not _is_ipv4(k):
            did = k.strip()
        devices.append({
            "ip": ip,
            "device_id": did,
            "version": str(row.get("version") or "3.3"),
            "product_key": row.get("productKey"),
            "mac": row.get("mac"),
            "raw": row,
        })
    return devices


class DiscoverIn(BaseModel):
    """Тело POST /v1/discover (и то, что проксирует backend)."""

    mode: str = Field(default="auto", description="auto | tuya_lan")
    want_ips: list[str] = Field(default_factory=list, description="Целевые IPv4 для донастройки скана")
    timeout_sec: int = Field(default=18, ge=5, le=120)


def _run_discovery(mode: str, timeout_sec: int, want_ips: list[str] | None) -> list[dict[str, Any]]:
    # tuya_lan — дольше слушаем эфир (лампы не всегда шлют UDP сразу).
    t = timeout_sec
    if (mode or "auto").strip().lower() == "tuya_lan":
        t = max(t, 26)
    t = max(5, min(int(t), 120))
    want = _clean_want_ips(want_ips)
    scanned = tuya_scanner.devices(
        verbose=False,
        scantime=t,
        color=False,
        poll=False,
        forcescan=False,
        byID=False,
        wantips=want,
        discover=True,
        assume_yes=True,
    )
    if scanned is None:
        return []
    return _normalize_scan(scanned if isinstance(scanned, dict) else None)


@app.get("/v1/discover")
def discover_devices_get(timeout_sec: int = 18):
    try:
        devices = _run_discovery("auto", timeout_sec, None)
        return {"ok": True, "count": len(devices), "devices": devices, "mode": "auto"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"tinytuya discover error: {e!s}") from e


@app.post("/v1/discover")
def discover_devices_post(body: DiscoverIn):
    try:
        mode = (body.mode or "auto").strip().lower()
        if mode not in ("auto", "tuya_lan"):
            raise HTTPException(status_code=400, detail="mode must be auto or tuya_lan")
        devices = _run_discovery(mode, body.timeout_sec, body.want_ips)
        return {"ok": True, "count": len(devices), "devices": devices, "mode": mode}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"tinytuya discover error: {e!s}") from e


@app.post("/v1/status")
def read_status(body: StatusRequest):
    """Прочитать статус устройства (сырой ответ прошивки)."""
    try:
        data, used_version = _with_version_fallback(body, lambda d: d.status())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"tinytuya error: {e!s}") from e
    if data is None:
        raise HTTPException(status_code=502, detail="Пустой ответ от лампы (проверь IP, ключ, версию протокола)")
    return {"raw": data, "used_version": used_version}


@app.post("/v1/switch")
def switch(body: SwitchRequest):
    """Вкл/выкл по указанному DPS (по умолчанию 1)."""
    try:
        payload, used_version = _with_version_fallback(
            body,
            lambda d: d.set_status(body.on, body.dps_switch),
        )
        return {"ok": True, "on": body.on, "dps": body.dps_switch, "used_version": used_version, "raw": payload}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"tinytuya error: {e!s}") from e


@app.post("/v1/brightness")
def set_brightness(body: BrightnessRequest):
    """Яркость: переводим лампу в white и пишем DPS 22."""
    try:
        dps = _percent_to_dps(body.percent)
        payload, used_version = _with_version_fallback(
            body,
            lambda d: (
                d.set_value(21, "white"),
                time.sleep(0.12),
                d.set_value(22, dps),
            ),
        )
        return {"ok": True, "brightness_percent": body.percent, "dps_value": dps, "dps": 22, "used_version": used_version, "raw": payload}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"tinytuya error: {e!s}") from e


@app.post("/v1/temperature")
def set_temperature(body: TemperatureRequest):
    """Теплота/холод лампы: white + DPS 23."""
    try:
        dps = _kelvin_to_dps(body.kelvin)
        payload, used_version = _with_version_fallback(
            body,
            lambda d: (
                d.set_value(21, "white"),
                time.sleep(0.12),
                d.set_value(23, dps),
            ),
        )
        return {"ok": True, "temperature_kelvin": body.kelvin, "dps_value": dps, "dps": 23, "used_version": used_version, "raw": payload}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"tinytuya error: {e!s}") from e


@app.post("/v1/color")
def set_color(body: ColorRequest):
    """RGB/HSV цвет: переводим в colour и пишем DPS 24."""
    try:
        s = _percent_to_1000(body.s_percent)
        v = _percent_to_1000(body.v_percent)
        encoded = _encode_color_hsv(body.h, s, v)
        payload, used_version = _with_version_fallback(
            body,
            lambda d: (
                d.set_value(21, "colour"),
                time.sleep(0.12),
                d.set_value(24, encoded),
            ),
        )
        return {
            "ok": True,
            "mode": "colour",
            "h": body.h,
            "s_percent": body.s_percent,
            "v_percent": body.v_percent,
            "dps_value": encoded,
            "dps": 24,
            "used_version": used_version,
            "raw": payload,
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"tinytuya error: {e!s}") from e
