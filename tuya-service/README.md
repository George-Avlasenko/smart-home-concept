# Tuya LAN service (TinyTuya)

Маленький HTTP-сервис: читает статус лампы и включает/выключает её **по локальной сети**, без облака Tuya и без приложений Алисы/Маруся.

## Что нужно от тебя

1. **Лампа и телефон/ПК в одной Wi‑Fi сети** (та же подсеть, что и у хоста, где запущен сервис).
2. **Device ID** — строка вида `bfxxxxxxxxxxxxxxxx` (из Tuya Developer, сканера tinytuya или выгрузки ключей).
3. **Local key** — секрет устройства; **никому не свети**, не коммить в репозиторий.
4. **IP лампы** в LAN — например `192.168.1.42` (лучше зафиксировать DHCP reservation на роутере).
5. **Версия протокола** — часто `3.3` или `3.4`; если статус не читается, перебери в интерфейсе страницы или в запросе.

Как достать **device id + local key**: см. [TinyTuya README](https://github.com/jasonacox/tinytuya) (раздел про получение ключей / Tuya IoT developer / локальный скан).

## Запуск с docker-compose (из корня репозитория)

```bash
docker compose up -d --build tuya-service
```

Сервис внутри сети compose: `http://tuya-service:8000`. С хоста: `http://localhost:5055`.

Фронт ходит на тот же origin через префикс **`/tuya/`** (см. `frontend/nginx.conf`).

## Запуск локально без Docker

```bash
cd tuya-service
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 5055
```

В `frontend/vite.config.ts` должен быть proxy на `5055` для `/tuya`.

## API

- `GET /health` — жив ли сервис.
- `POST /v1/status` — JSON: `device_id`, `local_key`, `ip`, опционально `version` (строка), `dps_switch` (число, по умолчанию 1).
- `POST /v1/switch` — то же + `"on": true|false`.

Пример:

```bash
curl -s http://localhost:5055/v1/status \
  -H "Content-Type: application/json" \
  -d '{"device_id":"...","local_key":"...","ip":"192.168.1.42","version":"3.3"}'
```

## Важно про Docker и LAN

Если контейнер **не видит** лампу по IP, на Linux можно попробовать `network_mode: host` для этого сервиса (тогда проброс порта `5055` не нужен). На Docker Desktop под Windows/macOS иногда проще запускать `uvicorn` **на хосте**, а не в контейнере.

## Безопасность

Сервис **без авторизации** — только для домашней сети / разработки. Не выставяй порт в интернет без reverse proxy и токена.
