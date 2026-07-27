# Demo interactivo con Ngrok — para cuando un director quiere probar solo

**Uso:** cuando después de la demo por Meet, el director te dice *"quiero probarlo yo también, dame acceso 2-3 días"*.

**Costo:** S/ 0.
**Tiempo de setup:** 5 minutos.

---

## Cómo funciona

Ngrok crea un "túnel" que expone tu Docker localhost:8095 a una URL pública de internet, sin tener que subir tu app a ningún servidor.

- Tu PC prendida → funciona el demo
- Tu PC apagada → se corta

Ideal para demos temporales de 24-72h.

---

## Setup inicial (1 sola vez, 5 minutos)

### 1. Crear cuenta gratis en Ngrok

- Ir a https://ngrok.com/signup
- Crear cuenta con email + contraseña
- Confirmar email

### 2. Instalar ngrok en tu PC

```bash
# Ubuntu con snap
sudo snap install ngrok

# O manualmente
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok
```

### 3. Autenticar con tu token

- En https://dashboard.ngrok.com/get-started/your-authtoken copiás tu token
- Corrés:

```bash
ngrok config add-authtoken TU_TOKEN_AQUI
```

---

## Cada vez que un director pide el demo (2 minutos)

### 1. Asegurate que el Docker esté corriendo

```bash
cd ~/WORKFULL/dev/p_03_ie_cesar_vallejo
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Verificar: `http://localhost:8095` debería responder.

### 2. Exponer con ngrok

```bash
ngrok http 8095
```

Vas a ver algo así:

```
Session Status                online
Account                       tu@email.com (Plan: Free)
Version                       3.14.0
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123def.ngrok-free.app -> http://localhost:8095
```

**La URL importante es:** `https://abc123def.ngrok-free.app`

### 3. Enviar al director

Copiá este mensaje por WhatsApp o email:

```
Director, listo para que pruebe el sistema los próximos 2-3 días:

🌐 URL del sistema:
https://abc123def.ngrok-free.app

👤 Usuarios de prueba (probar cada uno para ver la diferencia por rol):

Director:      director / director2026
Subdirector:   subdirector / subdir2026
Docente:       docente1 / docente2026
Admin TIC:     tic1 / tic2026
Secretaría:    secretaria / sec2026
Auxiliar:      auxiliar / aux2026
Psicóloga:     psicologa / psi2026
Conserje:      conserje / con2026
Padre:         padre1 / padre2026
Estudiante:    estudiante1 / estu2026

📱 IMPORTANTE:
- Es un DEMO. Los datos son ficticios.
- Si suben datos reales, se los borro al terminar.
- Después de 2-3 días desactivo el acceso.

📝 Qué le recomiendo probar:
1. Login como DIRECTOR: ver el panel de control
2. Login como DOCENTE: reportar una incidencia escribiendo en lenguaje natural
3. Login como PADRE (desde el celular): ver la asistencia del hijo
4. Cambiar entre "Modo Simple" y "Modo Completo" en el sidebar

Cualquier duda me escribís al 999-XXX-XXX.

Mark
```

### 4. Dejar la terminal abierta

- **NO cerrar la terminal** donde corre ngrok mientras dure el demo
- Si tenés que apagar la PC, el demo se corta

---

## Trucos útiles

### Ver quién está usando el demo

En otra terminal:
```bash
# Panel web de ngrok
open http://127.0.0.1:4040
```

Te muestra: cada request, IP, tiempo, respuesta. Útil para saber si el director realmente entró o no.

### Extender el demo más de 8 horas

Ngrok free desconecta después de 8 horas y cambia la URL. Para evitar esto:

- **Opción A:** correr `ngrok http --url=SUBDOMINIO.ngrok-free.app 8095` con dominio reservado (gratis 1 por cuenta)
- **Opción B:** después de la 1a venta, pagar Ngrok Personal (US$ 8/mes) para URL fija

### Configurar un subdominio fijo (gratis, recomendado)

1. Ir a https://dashboard.ngrok.com/cloud-edge/domains
2. Click "Create Domain"
3. Elegí un nombre: `demo-sistematic` → te da: `demo-sistematic.ngrok-free.app`
4. Cada vez que corras ngrok:

```bash
ngrok http --url=demo-sistematic.ngrok-free.app 8095
```

**Ventaja:** la URL siempre es la misma. Podés compartirla en la landing.

---

## Cuando termina el demo (30 seg)

```bash
# En la terminal donde corre ngrok, apretar Ctrl+C
# El sistema Docker sigue corriendo (para tu uso local), solo se corta el acceso externo
```

Si querés borrar los datos que subió el director:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod down -v
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
# Volver a correr los seeds
docker exec p_03_ie_cesar_vallejo-backend-1 python manage.py seed_usuarios --produccion
docker exec p_03_ie_cesar_vallejo-backend-1 python manage.py seed_asistencia
# ... otros seeds
```

---

## Alternativa MÁS FÁCIL: usar el subdominio fijo permanente

**Si vas a hacer varias demos, esto es lo mejor:**

1. Configurar subdominio fijo `demo-sistematic.ngrok-free.app` (paso arriba)
2. Cada vez que un director pide demo:
   - Prendés tu PC
   - Corrés: `ngrok http --url=demo-sistematic.ngrok-free.app 8095`
   - Le mandás siempre la MISMA URL
3. Ahorra tiempo, no cambia nada.

---

## Preguntas frecuentes

**¿Es seguro?**
Sí. Ngrok usa HTTPS. La URL es única e impredecible. Solo el que la conoce accede.

**¿Y si mi PC se apaga a media noche?**
El demo se corta hasta que la vuelvas a prender. Avisá al director de esa limitación.

**¿Puedo usar mi WiFi de casa?**
Sí, ngrok atraviesa cualquier NAT/router sin problema.

**¿Puedo usar mi celular como hotspot?**
Sí, funciona idéntico.

**¿Cuántos directores pueden usar el demo a la vez?**
Free tier permite ~40 conexiones/minuto. Suficiente para 5-10 personas simultáneas.

**¿El director puede romper algo?**
Peor caso: sube datos falsos que después borrás con el comando de arriba.
