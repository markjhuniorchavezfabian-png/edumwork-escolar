# Guía de Instalación Asistida — Sistema TIC Escolar

Modelo de entrega: **vos (Mark) instalás el sistema en el VPS del cliente vía SSH.**
No se distribuye código ni imágenes Docker públicas. El cliente nunca ve tu código fuente.

---

## Por qué este modelo

- **Tu código nunca sale de tu control.** Nada de Docker Hub público, nada de repos GitHub compartidos.
- **Cero costo fijo.** No pagás Docker Hub Pro, no pagás GitHub Team.
- **Mayor valor percibido.** El cliente ve una instalación profesional guiada.
- **Actualizaciones bajo tu control.** Si dejan de pagar, dejás de actualizar.
- **Escalable hasta ~50 clientes.** Después contratás un ayudante o migrás a Docker Hub privado.

---

## Requisitos que el cliente debe tener listos ANTES

1. **VPS Ubuntu 22.04+** (recomendados: SitioHost Perú, Elástika, DigitalOcean, Hetzner)
   - Mínimo: 4 GB RAM, 2 CPU, 60 GB disco.
2. **Acceso SSH root** al VPS (el cliente te da IP + password root, o mejor: sube tu clave pública SSH).
3. **Dominio propio** (opcional pero recomendado): `sistema.suescuela.edu.pe` apuntando al IP del VPS.
4. **Email SMTP** (Gmail, Resend, Brevo) para reset de contraseñas y notificaciones.
5. **API key de IA propia** (DeepSeek recomendado): el cliente la carga después desde el panel "Mi API de IA".
6. **Pago realizado** (transferencia bancaria con factura RUC, Yape, o lo acordado).

---

## Flujo paso-a-paso (25 minutos)

### 1. Cliente compra y te da acceso
- Enviás factura al cliente.
- El cliente responde con:
  - IP del VPS
  - Usuario root (o clave SSH pública configurada)
  - Nombre exacto de la I.E.
  - Datos del director / docente admin inicial
  - Dominio (si tiene)

### 2. Conectás por SSH desde tu laptop
```bash
ssh root@IP_DEL_VPS
```

Verificá que sea Ubuntu 22.04+:
```bash
lsb_release -a
```

### 3. Corrés el instalador desde TU repo privado
```bash
# Traés el instalador con tu Personal Access Token de GitHub
export TU_TOKEN="ghp_XXX..."  # tu token, no el del cliente
curl -sSL -H "Authorization: token $TU_TOKEN" \
  https://raw.githubusercontent.com/etdherhwrahaerherahetar/sistema-tic-escolar/main/deploy/install_colegio.sh \
  -o install.sh
sudo -E bash install.sh   # -E conserva TU_TOKEN: el clone del repo privado lo necesita
```

El instalador aborta si `TU_TOKEN` no llegó (sin token no puede clonar un repo
privado). Al terminar limpia el token del `.git/config`, así que no queda tu
credencial en el servidor del cliente.

El script te pregunta:
- Nombre corto y completo del colegio
- Edición: **1 (Completa)** o **2 (Solo Docente)** — según lo que compró
- Dominio o IP
- SMTP (podés dejar sin configurar y hacerlo después)
- Si es Edición Docente: datos del primer docente admin

Espera 15-20 min a que Docker arme todo.

### 4. Configurás HTTPS (si hay dominio)
```bash
sudo certbot --nginx -d sistema.suescuela.edu.pe
```

### 5. Verificás que todo funciona
- Abrís `https://sistema.suescuela.edu.pe` en tu navegador
- Logueás con las credenciales que creaste
- Verificás que salga el nombre del colegio y logo

### 6. Entregás credenciales al cliente
- Enviás por WhatsApp o email al director:
  - URL del sistema
  - Usuario y contraseña temporal (`debe_cambiar_password=True` obliga a cambiarla al primer login)
  - Link a la guía de usuario básica

### 7. Capacitación remota con RustDesk
- Instalás RustDesk en la PC del director (5 min)
- Te conectás visualmente y le mostrás:
  - Cómo dar de alta docentes
  - Cómo cargar estudiantes vía Excel
  - Cómo ver los reportes básicos
- Duración típica: 30-60 min.

---

## Actualizaciones futuras (parches gratis / features de pago)

Cuando saques una nueva versión:

### Parches (gratis, tú decides cuándo aplicarlos)
```bash
ssh root@IP_DEL_VPS
cd /opt/sistematic-NOMBRECORTO
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build backend frontend
```

### Actualizaciones mayores (con pago)
- Notificás al cliente por email/WhatsApp: "Salió Sistema TIC Pro 2027 con [X, Y, Z features]"
- Cliente confirma pago
- Repetís el proceso pero con la rama nueva:
```bash
git checkout v2.0.0
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

---

## Herramientas necesarias en tu laptop

| Uso | Herramienta | Comando |
|---|---|---|
| SSH al VPS del cliente | ssh (nativo Ubuntu/Mac) | `ssh root@IP` |
| Editar archivos remotos | nano/vim vía SSH | `nano archivo.conf` |
| Ver logs en vivo | docker compose logs | `docker compose logs -f backend` |
| Capacitación visual | RustDesk | https://rustdesk.com |
| Backup rápido | rsync | `rsync -avz root@IP:/opt/sistematic/backups ./` |
| Diagnóstico | htop, docker stats | `htop`, `docker stats` |

---

## Cuando el cliente reporta un problema

1. **Preguntá qué pasó** por WhatsApp/email.
2. **SSH al VPS** y revisá logs:
   ```bash
   docker compose logs --tail=200 backend
   docker compose logs --tail=200 frontend
   ```
3. **Si es UI/uso** → RustDesk para ver la pantalla y guiar.
4. **Si es bug del sistema** → arreglás en tu repo local, `git push`, luego SSH → `git pull` + rebuild.
5. **Logs importantes**:
   - Backend: `docker compose logs backend | grep ERROR`
   - Postgres: `docker compose logs db | tail`
   - Nginx: `journalctl -u nginx --since "10 min ago"`

---

## Seguridad — checklist post-instalación

- [ ] `.env.prod` con `chmod 600` (solo root lee)
- [ ] Firewall UFW activo (solo 22, 80, 443)
- [ ] SSH key configurada, password root deshabilitado
- [ ] HTTPS activo con certbot
- [ ] Backup diario en cron
- [ ] Credenciales del director enviadas por canal seguro (no WhatsApp público)
- [ ] Docker Hub credenciales NO están en el VPS (no las necesitás)
- [ ] Repo GitHub del cliente NO existe (tu repo privado no se clona al VPS del cliente sin token)

---

## Cuándo migrar a otro modelo

Si llegás a **20+ clientes activos**, considerá:
- **Docker Hub Pro (US$5/mes)** con imágenes privadas → cliente hace `docker pull` con credenciales
- **CI/CD** (GitHub Actions) que buildea y pushea automático
- **Ansible playbooks** para instalación en batch
- **Contratar ayudante** para manejar instalaciones e incidencias

Hasta esos 20 clientes, este modelo asistido es el mejor.
