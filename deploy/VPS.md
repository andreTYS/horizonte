# Desplegar HORIZONTE en el VPS (Docker + Traefik)

HORIZONTE corre como un contenedor más detrás del **Traefik del VPS de Moqueguasoft** (`traefik-n0do`). No abre puertos propios: Traefik lo enruta por dominio y pone el HTTPS.

```
Internet ──80/443──▶ traefik-n0do ──traefik-network──▶ horizonte:8080 (Node)
                                                            ├─ juego (estáticos)
                                                            ├─ /api/partidas    resultados de los estudiantes
                                                            ├─ /api/resultados  panel docente (con clave)
                                                            ├─ /api/donki       NASA DONKI con caché (key solo en el servidor)
                                                            └─ SQLite en el volumen horizonte_datos
```

## 1. Valores de este VPS (ya configurados en `docker-compose.yml`)

| Qué | Valor |
|---|---|
| Traefik | `traefik-n0do-traefik-1` (`traefik:latest`) |
| Red | `traefik-network` |
| Entrypoints | `web` (redirige a https) y `websecure` |
| Certresolver | `letsencrypt` |
| Carpeta | `/opt/horizonte` (junto a `/opt/stellarscribe`) |

## 2. DNS

Crea un registro **A** `horizonte.moqueguasoft.com` → `76.13.234.161` (por la API de Hostinger, como en tus otros sitios).

## 3. Clonar y configurar

```bash
git clone https://github.com/andreTYS/horizonte.git /opt/horizonte && cd /opt/horizonte
```

```bash
cp .env.example .env && nano .env
```

Completa `DOMINIO`, `NASA_API_KEY` y `DOCENTE_TOKEN`. Puedes generar el token con `openssl rand -hex 24`.

## 4. Levantar

```bash
docker compose up -d --build
```

Comprueba que está sano (en ~10 s pasa a `healthy`; **Traefik no enruta contenedores en estado `starting`**):

```bash
docker ps --filter name=horizonte --format '{{.Names}} {{.Status}}'
```

```bash
curl https://TU_DOMINIO/api/salud
```

Debe responder `{"ok":true,"nasa":true}`.

## 5. Actualizar

```bash
cd /opt/horizonte && git pull && docker compose up -d --build
```

## Panel docente

`https://TU_DOMINIO/docente.html`: el docente pone el **código de aula** y la clave `DOCENTE_TOKEN`. Los estudiantes escriben el mismo código en la portada del juego (*Tu nombre y aula*).

## Respaldo de resultados

```bash
docker compose cp horizonte:/app/datos/horizonte.db ./respaldo-$(date +%F).db
```

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| `404 page not found` de Traefik | El contenedor aún está en `starting` o `unhealthy` (Traefik no lo enruta hasta que esté `healthy`) |
| Certificado inválido | El DNS aún no apunta al VPS; espera a que propague y reinicia el contenedor |
| `/api/salud` responde `"nasa":false` | Falta `NASA_API_KEY` en `.env`; reinicia con `docker compose up -d` |
| Ver errores | `docker compose logs -f horizonte` |

> Verificado con Traefik v3.6: enrutado por dominio, TLS, compresión gzip y API funcionando. Con versiones de Traefik anteriores a v3.2 el proveedor Docker puede fallar contra Docker Engine 29 ("client version 1.24 is too old"); en ese caso actualiza la imagen de Traefik.
