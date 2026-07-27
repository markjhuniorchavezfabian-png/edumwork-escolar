# Ambientes de EduMWork — cuál usar y cuándo

Este proyecto tiene **3 ambientes** con `docker-compose.*.yml`. NUNCA los mezcles ni corras dos a la vez.

## Cuadro resumen

| Ambiente | Archivo | Cuándo | Puerto frontend | Código | Imágenes |
|---|---|---|---|---|---|
| **DEV** | `docker-compose.yml` | Estás programando | 5173 (Vite hot-reload) | Montado como volumen — cambio código y ves cambios | Se buildea local |
| **DEMO** | `docker-compose.prod.yml` | Le muestras al cliente / probás como sería en producción | 80 | Compilado en imagen | Build local con `docker compose build` |
| **CLIENTE** | `docker-compose.colegio.yml` | Se instala en el VPS del colegio | 80/443 | Compilado | Descargadas de tu registry (`<registry>/<prefijo>/edumwork-*:<version>`) |

## Cuál elegir en 2 preguntas

1. **¿Estoy escribiendo código y quiero verlo al instante?** → `DEV`
2. **¿Estoy mostrando el sistema a alguien / haciendo QA final?** → `DEMO`
3. **¿Estoy instalando en un colegio real?** → `CLIENTE` (via `install_colegio.sh`)

---

## Comandos por ambiente

### DEV — desarrollo diario
```bash
cd ~/WORKFULL/dev/p_03_ie_cesar_vallejo
docker compose up -d db backend    # DB + API en Docker
cd frontend && npm run dev         # Frontend en tu host (puerto 5173)
```
URL: `http://localhost:5173`

### DEMO — mostrar al cliente (con ngrok)
```bash
cd ~/WORKFULL/dev/p_03_ie_cesar_vallejo
bash demo.sh
```
El script apaga otros stacks conflictivos, buildea si hace falta, arranca todo y te muestra la URL de ngrok.

### CLIENTE — instalar en un colegio
En el VPS del colegio (Ubuntu 22.04+):
```bash
sudo bash install_colegio.sh
```
Descarga las imágenes de Docker Hub. No requiere código fuente.

---

## Reglas de oro

1. **Un ambiente a la vez.** Antes de encender uno, `docker compose down` en todos los otros.
2. **Puerto 80 conflicto:** DEMO y CLIENTE usan el 80. No pueden coexistir con `mi-cv`, `ntfy` u otros que binden 80.
3. **Puerto 8000 conflicto:** DEV backend usa 8000. Choca con `gpt-researcher`. Apaga uno antes de levantar el otro.
4. **axes bloquea IPs.** Si te loguean mal 5 veces, el sistema te bloquea 30 min. Fix:
   ```bash
   docker exec p03_postgres psql -U edumwork -d edumwork -c "DELETE FROM axes_accessattempt;"
   ```
5. **ngrok se queda pegado con el URL viejo.** Si cambias el puerto del frontend, edita `~/.config/ngrok/ngrok.yml` (línea `addr:`) y reinicia `ngrok start edumwork`.

---

## Estructura de contenedores por ambiente

### DEV
- `p03_postgres` (5432)
- `p03_backend` (8000)
- Frontend corre en tu host (no en Docker)

### DEMO
- `p_03_ie_cesar_vallejo-db-1`
- `p_03_ie_cesar_vallejo-backend-1`
- `p_03_ie_cesar_vallejo-redis-1`
- `p_03_ie_cesar_vallejo-frontend-1` (puerto 80)

### CLIENTE (colegio)
- Igual que DEMO + Watchtower para auto-updates desde Docker Hub

---

## Preguntas frecuentes

**¿Los problemas de puerto se replican en el VPS del colegio?**
No. El VPS solo corre EduMWork. Los conflictos son solo en tu máquina porque tienes 10 stacks distintos.

**¿Puedo tener DEV y DEMO a la vez?**
No. Ambos usan el mismo backend/DB. Elegí uno.

**¿Qué pasa si cambio código estando en DEMO?**
Nada. DEMO usa imágenes ya buildeadas. Para ver cambios: `docker compose -f docker-compose.prod.yml build && docker compose -f docker-compose.prod.yml up -d`. O mejor, pasate a DEV.

**¿Cómo subo cambios al registry (para que llegue a los colegios)?**
```bash
# Docker Hub
export DOCKER_REGISTRY=docker.io IMAGE_PREFIX=edumwork VERSION=1.0.0
bash scripts/build-release.sh
PUSH=true bash scripts/build-release.sh

# GitHub Container Registry
export DOCKER_REGISTRY=ghcr.io IMAGE_PREFIX=edumwork VERSION=1.0.0
PUSH=true bash scripts/build-release.sh
```
Los colegios lo reciben automáticamente en la próxima ventana de Watchtower (3 AM).
