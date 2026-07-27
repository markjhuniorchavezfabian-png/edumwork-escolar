# Guía para el director del colegio — Cómo empezar

Esta guía te dice exactamente qué contratar y qué hacer para tener el Sistema TIC de tu colegio funcionando en menos de 1 hora.

---

## 📋 Paso 1 · Contratá un servidor VPS peruano

Necesitas un servidor "**VPS con Docker y root SSH**" con al menos **2 GB de RAM, 1 vCPU, 40 GB SSD**.

### 🥇 Opción recomendada: **SitioHost.pe**

- **URL:** https://www.sitiohost.pe/vps/
- **Plan:** VPS 2 GB
- **Precio:** **S/ 30 + IGV = S/ 35.40 al mes**
- **Datacenter:** Perú (baja latencia para tu colegio)
- **Pago:** Yape · PagoEfectivo · Transferencia BCP/Interbank/BBVA
- **Factura con RUC del colegio:** ✅ Sí

**Cómo contratar:**
1. Entrá a la web y elegí "VPS 2 GB"
2. Sistema operativo: **Ubuntu 22.04 o 24.04**
3. Panel: sin panel (dejalo puro)
4. Método de pago: **transferencia bancaria** — el más simple para rendir el gasto a UGEL
5. Ponéle al servidor un hostname (ej: `sistema-cesarvallejo`)
6. Te llegan por email: IP del servidor, usuario `root` y contraseña

### 🥈 Opción #2: **Elástika.pe**

- **URL:** https://elastika.pe/vps
- **Plan:** VPS 2 GB
- **Precio:** **S/ 28 al mes (IGV incluido)**
- **Datacenter:** Lima Tier III (mejor redundancia)
- **Pago:** PagoEfectivo, tarjetas Visa/MC/Amex (NO Yape directo)
- **Factura con RUC:** ✅ Sí

Elegí Elástika si el colegio prefiere Tier III o solo va a pagar con tarjeta.

### 🥉 Opción #3 (si querés algo más grande): **DonWeb Perú**

- **URL:** https://donweb.com/es-pe/cloud-server-vps
- **Precio:** ~S/ 40-55/mes
- **Datacenter:** Argentina (poca diferencia de latencia)
- **Pago:** PayU (acepta Yape, BCP, Interbank, PagoEfectivo, tarjetas)
- **Factura con RUC:** ✅

Ideal si querés más RAM o pensás crecer.

### ⚠ Evitar (para colegios sin tarjeta internacional)

- **Hostinger** — renueva en USD, soporte no maneja Yape
- **Contabo** — muy barato pero solo tarjeta internacional, sin RUC peruano
- **Digital Ocean / Vultr / AWS** — mismo problema, tarjeta internacional

---

## 💳 Paso 2 · Método de pago recomendado

Para colegio **público** rendirle el gasto a UGEL requiere:
- ✅ **Comprobante bancario** (voucher de transferencia)
- ✅ **Factura electrónica SUNAT** con el RUC del colegio

Por eso te recomendamos: **Transferencia bancaria + factura con RUC**. Cualquier otro método (Yape, PagoEfectivo) también funciona pero es más engorroso administrativamente.

Para colegio **privado**: cualquier método aceptado por el proveedor.

**Presupuesto anual estimado:**
- Servidor: S/ 30-40 × 12 = **S/ 360-480 / año**
- Dominio `.edu.pe` (opcional): **S/ 130 / año**
- **Total: S/ 490-610 / año** — muy accesible incluso para colegios chicos.

---

## 🌐 Paso 3 · Dominio (opcional pero recomendado)

Podés arrancar sin dominio usando la IP del servidor, pero si querés algo profesional:

### Opción A: Dominio `.pe` genérico
- **Precio:** ~S/ 130/año
- **Registro:** cualquier registrador (SitioHost, Punto.pe, GoDaddy)
- **Nombre sugerido:** `sistematic-[nombre-colegio].pe`

### Opción B: Dominio `.edu.pe` oficial (recomendado para IE públicas)
- **Precio:** ~S/ 130/año
- **Requisito:** Resolución Directoral vigente + trámite en RED.PE
- **Ventaja:** genera confianza, indica que es IE oficial
- **Nombre sugerido:** `sistema.[colegio].edu.pe`

### Configuración DNS

Una vez comprado el dominio, en el panel del registrador:
1. Andá a "**DNS Zone**"
2. Creá un registro tipo **A**:
   - Nombre: `sistema` (o el subdominio que elegiste)
   - Valor: la IP del servidor VPS
   - TTL: 3600
3. Esperá 15-60 min para que propague
4. Verificá con `ping sistema.tucolegio.edu.pe`

---

## 🚀 Paso 4 · Instalación automática (1 comando)

Ya tenés el servidor con Ubuntu y opcionalmente el dominio. Ahora conectate por SSH:

```bash
ssh root@TU_IP_DEL_SERVIDOR
```

Y corré:

```bash
curl -sSL https://raw.githubusercontent.com/etdherhwrahaerherahetar/sistema-tic-escolar/main/deploy/install_colegio.sh | sudo bash
```

El script te va a preguntar:
1. Nombre corto del colegio (ej: `cesarvallejo`)
2. Nombre completo (ej: `I.E. C.N. César Vallejo`)
3. Código modular (opcional)
4. Si querés dominio o usás la IP
5. Si querés dominio: cuál y qué email para SSL

Y en **15-25 minutos** hace todo:
- Instala Docker, Nginx, Firewall, Certbot
- Descarga el sistema
- Genera claves seguras aleatorias
- Levanta Postgres + Redis + Backend + Frontend
- Configura HTTPS gratis con Let's Encrypt
- Crea usuarios iniciales (director, subdirector, docente1, admin_tic, etc.)
- Configura backup diario automático
- Programa las alertas de convivencia y rotación de QR

Cuando termine, te muestra la URL de acceso y dónde bajar el CSV con las credenciales iniciales.

---

## ✅ Paso 5 · Primera vez en el sistema

1. Abrí tu navegador: `https://tu-dominio.pe` (o `http://tu-ip`)
2. Login con **director / [password del CSV descargado]**
3. Cambiá el password inmediatamente en tu perfil
4. Vas a: **Administración → Usuarios** → crear cuentas para los docentes reales del colegio
5. Vas a: **Administración → Importar Excel** → subir el padrón de estudiantes
6. Empezá a usar todos los módulos

**Los primeros 5 usuarios seed que se crean automáticamente:**
- Director, Subdirector, Docente demo, Admin TIC, Secretaría, Padre demo, Estudiante demo

Usalos para explorar el sistema. Después los reemplazás con los reales del colegio.

---

## 🛡 Mantenimiento y seguridad

### Actualizaciones
Cada tanto sale una versión nueva del sistema. Para actualizar:

```bash
ssh root@tu-ip
cd /opt/sistematic-tucolegio
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Toma 3-5 minutos. Cero pérdida de datos (los volúmenes de Docker se preservan).

### Backup
Automático diario a las 6:25 AM del servidor. Se guardan los últimos 30 días en `/var/backups/sistematic/`.

Para descargarlos a tu compu:
```bash
scp root@tu-ip:/var/backups/sistematic/backup-20260712.sql.gz .
```

Guardalos en tu Google Drive o similar por seguridad.

### Restaurar un backup

```bash
cd /opt/sistematic-tucolegio
gunzip -c /var/backups/sistematic/backup-20260712.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U sistematic sistematic
```

### Ver logs si algo falla

```bash
cd /opt/sistematic-tucolegio
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## 📞 Soporte

Si algo falla:
1. Revisá los logs con el comando de arriba
2. Contactame a `cmarkjhunior@gmail.com` con:
   - Nombre del colegio
   - IP del servidor
   - Últimas 20 líneas del log
   - Descripción del problema
3. Respuesta en 24-48 h para errores no críticos, mismo día para bugs bloqueantes

---

## 💰 Costo total anual estimado

| Ítem | Costo |
|---|---|
| VPS SitioHost 2 GB | S/ 35 × 12 = **S/ 420** |
| Dominio `.edu.pe` | **S/ 130** |
| Backup en Google Drive (opcional) | S/ 0 (usa el gratis) |
| **Total 1er año** | **S/ 550** |
| Total años siguientes | **S/ 550** |

Comparalo con licencias de sistemas comerciales similares (S/ 300-500 **por mes**). Amortizás en el primer trimestre.
