# Checklist de entrega a cliente — EduMWork Sistema TIC Escolar

Marcar cada ítem antes de dar por terminada la instalación.

## 1. Infraestructura

- [ ] VPS con Ubuntu 22.04+ o Debian 12+, mínimo 2 GB RAM, 2 vCPU, 30 GB SSD.
- [ ] Docker y Docker Compose plugin instalados (`docker compose version` funciona).
- [ ] Puertos 80 y 443 abiertos en el firewall (si aplica dominio + HTTPS).
- [ ] Dominio apuntando al VPS (A record: `sistema.tu-colegio.edu.pe` → IP).
- [ ] `.env` generado por `install_colegio.sh`, con permisos 600.

## 2. Instalación del sistema

- [ ] Ejecutado `sudo bash install_colegio.sh` sin errores.
- [ ] `docker compose -f docker-compose.colegio.yml ps` muestra todos los contenedores `Up`.
- [ ] Backend responde `/health/` (`docker compose exec backend curl -sf http://localhost:8000/health/`).
- [ ] `scripts/qa_instalacion.sh` pasa todo.

## 3. Configuración institucional

- [ ] Nombre del colegio correcto en **Configuración institucional → Datos**.
- [ ] Sigla y email institucional configurados.
- [ ] Logo subido (PNG/JPG, máx 2 MB).
- [ ] Año lectivo activo correcto.

## 4. Acceso inicial

- [ ] Usuario `director` puede iniciar sesión.
- [ ] Contraseña del director cambiada en el primer ingreso.
- [ ] Rol de director tiene acceso a todas las secciones esperadas.

## 5. Email (opcional pero recomendado)

- [ ] SMTP configurado en **Configuración → Envío de correos** (host, puerto, usuario, contraseña/app-password).
- [ ] Test de email enviado y recibido.
- [ ] `DEFAULT_FROM_EMAIL` o `email_institucional` configurado.

## 6. Backups

- [ ] Backup manual ejecutado con éxito.
- [ ] Cron de backup diario activo (`crontab -l | grep edumwork-backup`).
- [ ] Backup descargado y almacenado fuera del VPS (Google Drive, Dropbox, S3, etc.).

## 7. Seguridad

- [ ] `SECRET_KEY` generado automáticamente y no es el default.
- [ ] `ALLOWED_HOSTS` incluye el dominio del cliente.
- [ ] `DEBUG=False` en producción.
- [ ] HTTPS activo si se usa dominio (Caddy genera certificado automático).

## 8. Documentos entregados al cliente

- [ ] URL del sistema.
- [ ] Usuario y contraseña inicial del director.
- [ ] Guía de primeros pasos (`GUIA_COLEGIO.md` o resumen impreso).
- [ ] Canal de soporte: soporte@edumwork.pe.

## 9. Post-instalación

- [ ] Watchtower activo para actualizaciones automáticas.
- [ ] Cuenta de soporte con acceso al VPS/SSH/documentado.
- [ ] Fecha de revisión de backups acordada con el cliente.

---

**Firma / fecha de entrega:** _________________________
**Responsable EduMWork:** _________________________
**Responsable del colegio:** _________________________
