# Desplegar HORIZONTE en el VPS (Docker + Traefik)

HORIZONTE corre como un contenedor más detrás del **Traefik que ya tienes en el VPS**. No abre puertos propios: Traefik lo enruta por dominio y pone el HTTPS.

```
Internet ──443──▶ Traefik (ya existente) ──red "traefik"──▶ horizonte:8080 (Node)
                                                            ├─ juego (estáticos)
                                                            ├─ /api/partidas    resultados de los estudiantes
                                                            ├─ /api/resultados  panel docente (con clave)
                                                            ├─ /api/donki       NASA DONKI con caché (key solo en el servidor)
                                                            └─ SQLite en el volumen horizonte_datos
```

## 1. Saca los valores de tu Traefik

Lo único que hay que alinear son 3 nombres. Míralos en el VPS:

```bash
docker network ls --format '{{.Name}}' | grep -iE 'traefik|proxy|web'
```

```bash
docker inspect $(docker ps -qf name=traefik) --format '{{join .Args "\n"}}' | grep -E 'entrypoints|certificatesresolvers' | sort -u
```

Si tu Traefik usa `traefik.yml` en vez de argumentos, mira ahí las secciones `entryPoints` y `certificatesResolvers`.

| Variable en `.env` | Qué es | Valor típico |
|---|---|---|
| `TRAEFIK_NETWORK` | Red Docker externa donde está Traefik | `traefik`, `proxy` o `web` |
| `TRAEFIK_ENTRYPOINT` | Entrypoint HTTPS | `websecure` |
| `TRAEFIK_CERTRESOLVER` | Resolver de Let's Encrypt | `letsencrypt`, `le` o `myresolver` |

## 2. DNS

Crea un registro **A** `horizonte.tudominio.pe` apuntando a la IP del VPS (por la API de Hostinger, como en tus otros sitios).

## 3. Clonar y configurar

```bash
git clone https://github.com/andreTYS/horizonte.git && cd horizonte
```

```bash
cp .env.example .env && nano .env
```

Completa `DOMINIO`, las 3 variables de Traefik, `NASA_API_KEY` y `DOCENTE_TOKEN`. Puedes generar el token con `openssl rand -hex 24`.

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
git pull && docker compose up -d --build
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
| `404 page not found` de Traefik | El contenedor aún está en `starting` o `unhealthy`; `TRAEFIK_NETWORK` no es la red de Traefik; o `TRAEFIK_ENTRYPOINT` no coincide |
| Certificado inválido | `TRAEFIK_CERTRESOLVER` no coincide con el de tu Traefik, o el DNS aún no apunta al VPS |
| `network traefik declared as external, but could not be found` | Cambia `TRAEFIK_NETWORK` por el nombre real de la red |
| `/api/salud` responde `"nasa":false` | Falta `NASA_API_KEY` en `.env`; reinicia con `docker compose up -d` |
| Ver errores | `docker compose logs -f horizonte` |

> Verificado con Traefik v3.6: enrutado por dominio, TLS, compresión gzip y API funcionando. Con versiones de Traefik anteriores a v3.2 el proveedor Docker puede fallar contra Docker Engine 29 ("client version 1.24 is too old"); en ese caso actualiza la imagen de Traefik.
