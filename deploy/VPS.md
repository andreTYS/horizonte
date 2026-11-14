# Desplegar HORIZONTE en un VPS

Todo corre en el VPS con **Docker**: el juego, la API (partidas, panel docente, proxy de la NASA) y **Caddy** con HTTPS automático.

```
Internet ──443──▶ Caddy (HTTPS) ──▶ horizonte:8080 (Node)
                                     ├─ juego (archivos estáticos)
                                     ├─ /api/partidas   resultados de los estudiantes
                                     ├─ /api/resultados panel docente (con clave)
                                     ├─ /api/donki      NASA DONKI con caché (la key queda en el servidor)
                                     └─ SQLite en el volumen "datos"
```

## Requisitos

- VPS con Ubuntu 22.04 o 24.04, 1 vCPU, 1 GB de RAM (sirve el plan más básico de Hostinger, DigitalOcean, etc.).
- Un dominio o subdominio (p. ej. `horizonte.tudominio.pe`) con un registro **A** apuntando a la IP del VPS.
- Puertos 80 y 443 abiertos.

## 1. Instalar Docker (una sola vez)

```bash
curl -fsSL https://get.docker.com | sudo sh
```

```bash
sudo usermod -aG docker $USER && newgrp docker
```

## 2. Descargar el juego y configurarlo

```bash
git clone https://github.com/andreTYS/horizonte.git && cd horizonte
```

```bash
cp .env.example .env && nano .env
```

En `.env` completa:

| Variable | Qué poner |
|---|---|
| `DOMINIO` | Tu dominio, sin `https://` |
| `NASA_API_KEY` | Tu clave de https://api.nasa.gov |
| `DOCENTE_TOKEN` | Una clave larga para el panel docente (puedes generarla con `openssl rand -hex 24`) |

> `.env` nunca se sube a GitHub (está en `.gitignore`).

## 3. Levantar

```bash
docker compose up -d --build
```

En 1–2 minutos Caddy obtiene el certificado y el juego queda en `https://TU_DOMINIO`.

Comprobar:

```bash
curl https://TU_DOMINIO/api/salud
```

Debe responder `{"ok":true,"nasa":true}`.

## 4. Actualizar después de cada cambio

```bash
git pull && docker compose up -d --build
```

## Panel docente

`https://TU_DOMINIO/docente.html`: el docente escribe el **código de aula** y la **clave docente** (`DOCENTE_TOKEN`).
Los estudiantes escriben el mismo código de aula en la portada del juego (sección *Tu nombre y aula*).
Ve intentos, éxitos y rebobinados por misión, en qué fallan más y cada partida.

## Copia de seguridad de los resultados

```bash
docker compose exec horizonte node -e "require('fs').copyFileSync('/app/datos/horizonte.db','/app/datos/respaldo.db')"
```

```bash
docker compose cp horizonte:/app/datos/respaldo.db ./respaldo-$(date +%F).db
```

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| Caddy no obtiene el certificado | El dominio aún no apunta a la IP, o los puertos 80/443 están cerrados en el firewall del proveedor |
| `/api/salud` responde `"nasa":false` | Falta `NASA_API_KEY` en `.env` (reinicia con `docker compose up -d`) |
| El panel docente dice "Clave incorrecta" | `DOCENTE_TOKEN` distinto al de `.env` |
| Ver errores | `docker compose logs -f horizonte` |
