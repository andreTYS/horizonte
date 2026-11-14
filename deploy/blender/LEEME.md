# Blender en el VPS (en el navegador) + Blender MCP

Blender corre en un contenedor (`lscr.io/linuxserver/blender`) y se usa desde el navegador en `https://blender.moqueguasoft.com`, detrás de Traefik y con usuario y clave.
Lo que se exporta a `/config/horizonte` queda directamente en `/opt/horizonte/assets/modelos` (los modelos del juego).

## 1. Levantar (una sola vez)

DNS: registro **A** `blender` → `76.13.234.161`.

```bash
mkdir -p /opt/blender && cp /opt/horizonte/deploy/blender/docker-compose.yml /opt/horizonte/deploy/blender/.env.example /opt/blender/ && cd /opt/blender && cp .env.example .env && sed -i "s|^BLENDER_CLAVE=.*|BLENDER_CLAVE=$(openssl rand -base64 24)|" .env && nano .env
```

```bash
chown -R 1000:1000 /opt/horizonte/assets/modelos
```

(Para que Blender, que corre como usuario 1000, pueda guardar los modelos en la carpeta del juego.)

```bash
cd /opt/blender && docker compose up -d && docker compose logs -f --tail 30
```

La imagen pesa ~2–3 GB; la primera vez tarda unos minutos. Para ver la clave: `grep BLENDER_CLAVE /opt/blender/.env`.

Abre `https://blender.moqueguasoft.com`, entra con tu usuario y clave: verás Blender en el navegador.

## 2. Instalar Blender MCP dentro del Blender del VPS

1. Descarga el complemento al VPS:

```bash
curl -L -o /opt/blender/config/addon.py https://raw.githubusercontent.com/ahujasid/blender-mcp/main/addon.py
```

   En el Blender del navegador: *Edit → Preferences → Add-ons → Install from Disk* → `/config/addon.py`.
   En las preferencias del complemento, cambia **Bind Address** de `localhost` a `0.0.0.0` (para que escuche dentro del contenedor).
   El puerto 9876 solo está publicado en `127.0.0.1` del VPS, así que **no queda abierto a internet**.
2. Activa el complemento, abre la barra lateral del visor 3D (tecla **N**) → pestaña **BlenderMCP** → **Connect**.

## 3. Conectar Claude Desktop (en tu PC con Windows)

Abre un túnel SSH y déjalo abierto mientras trabajas:

```bash
ssh -N -L 9876:localhost:9876 root@76.13.234.161
```

En Claude Desktop → *Settings → Developer → Edit Config* (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "blender": { "command": "uvx", "args": ["blender-mcp"] }
  }
}
```

(Necesitas `uv` en Windows: `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`.)
Reinicia Claude Desktop: el MCP se conecta a `localhost:9876`, que por el túnel es el Blender del VPS.

## 4. Flujo para HORIZONTE

1. En Claude Desktop: *"Importa `/config/horizonte/fuente/habitat.glb` y mejóralo…"* (los modelos base ya están en `fuente/`).
2. Exporta como glTF Binary a `/config/horizonte/habitat.glb`.
3. Regístralo en `/opt/horizonte/assets/modelos/manifest.json` (ver `assets/modelos/LEEME.md`) y publica:

```bash
cd /opt/horizonte && docker compose up -d --build
```

4. Guarda los modelos en GitHub (`git add assets/modelos && git commit && git push`) para no perderlos.

## Recursos y seguridad

- Límite de 3 CPU y 6 GB de RAM para no afectar a los demás proyectos. Apágalo cuando no lo uses: `cd /opt/blender && docker compose stop`.
- Sin GPU: modelar va bien; el render realista (Cycles) usa CPU y es lento, Eevee puede no funcionar. El juego no lo necesita: dibuja Three.js en el navegador.
- Es un escritorio completo: usa una clave larga y no compartas la URL. El puerto de Blender MCP nunca debe publicarse en `0.0.0.0`.
