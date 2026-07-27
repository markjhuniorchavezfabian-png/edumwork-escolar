"""Import masivo de padres y estudiantes desde Excel.
El director/secretaría descarga template, lo llena con datos SIAGIE, lo sube."""
import io
from datetime import datetime

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

from apps.usuarios.models import Docente, Estudiante, Padre, Rol, Seccion, Usuario


def _password_inicial(dni: str) -> str:
    """Password inicial: dni + '2026'. Fácil de recordar."""
    dni = str(dni or "").strip()
    return f"{dni[:6] or 'cambiar'}2026"


# ═════════════════════════════════════════════════════════════════════════════
# TEMPLATES
# ═════════════════════════════════════════════════════════════════════════════

COLUMNAS_ESTUDIANTES = [
    # (etiqueta, obligatorio, ancho, ejemplo)
    ("DNI", True, 10, "12345678"),
    ("Apellido Paterno", True, 18, "Quispe"),
    ("Apellido Materno", True, 18, "Rojas"),
    ("Nombres", True, 22, "Juan Carlos"),
    ("Cód. Estudiante SIAGIE", False, 20, "25151881000180"),
    ("Fecha nacimiento\n(DD/MM/AAAA o AAAA-MM-DD)", False, 18, "15/05/2010"),
    ("Sexo (M/F)", False, 8, "M"),
    ("Grado", True, 10, "5to"),
    ("Sección", True, 8, "A"),
    ("Código matrícula", False, 16, "20260001"),
    ("Correo (opcional)", False, 22, "juan@ejemplo.com"),
    ("Teléfono", False, 14, "999999999"),
    ("Dirección", False, 30, "Jr. Prolongación 245"),
    ("Distrito", False, 15, "Amarilis"),
    ("Provincia", False, 15, "Huánuco"),
    ("Departamento", False, 15, "Huánuco"),
    ("Lugar nacimiento", False, 22, "Huánuco, Huánuco"),
    ("Lengua materna", False, 15, "Castellano"),
    ("Religión", False, 15, "Católica"),
    ("Colegio anterior", False, 25, "I.E. San José"),
    ("Fecha ingreso IE\n(AAAA-MM-DD)", False, 16, "2022-03-01"),
    # Ficha médica
    ("Grupo sanguíneo\n(O+, A-, NS…)", False, 12, "O+"),
    ("Tiene seguro (SI/NO)", False, 12, "SI"),
    ("Tipo seguro (SIS, ESSALUD…)", False, 18, "SIS"),
    ("Alergias", False, 22, "Ninguna"),
    ("Medicamentos", False, 22, ""),
    ("Condición médica\n/ discapacidad", False, 22, ""),
    # Contacto emergencia
    ("Emergencia — Nombre", False, 22, "Ana Rojas"),
    ("Emergencia — Parentesco", False, 15, "Madre"),
    ("Emergencia — Teléfono", False, 14, "988888888"),
    # Socioeconómico
    ("Vive con", False, 20, "Ambos padres"),
    ("N° hermanos", False, 10, "2"),
    ("Trabaja (SI/NO)", False, 10, "NO"),
    ("Tiene luz (SI/NO)", False, 10, "SI"),
    ("Tiene agua (SI/NO)", False, 10, "SI"),
    ("Tiene internet (SI/NO)", False, 12, "NO"),
]


def _si_no_bool(val, default=None):
    s = str(val or "").strip().upper()
    if s in ("SI", "SÍ", "S", "YES", "Y", "1", "TRUE", "VERDADERO"):
        return True
    if s in ("NO", "N", "0", "FALSE", "FALSO"):
        return False
    return default


def _fecha(val):
    if val is None or val == "":
        return None
    if hasattr(val, "date"):
        return val.date()
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            continue
    return None


def template_estudiantes() -> bytes:
    """Plantilla con las 34 columnas oficiales (DNI + básicos + dirección + médicos + emergencia + socioeconómicos).
    Solo DNI/Apellidos/Nombres/Grado/Sección son obligatorios; el resto es opcional pero se recomienda llenar."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Estudiantes"

    n_cols = len(COLUMNAS_ESTUDIANTES)
    ultima_col_letra = _col_letter(n_cols)

    ws["A1"] = "PLANTILLA DE IMPORTACIÓN — FICHA COMPLETA DE ESTUDIANTES"
    ws["A1"].font = Font(size=13, bold=True, color="1E3A5F")
    ws.merge_cells(f"A1:{ultima_col_letra}1")

    ws["A2"] = ("Complete una fila por estudiante. Columnas con * son obligatorias. "
                "El resto se puede completar en el sistema después. Guarde el archivo y súbalo desde "
                "'Importar Excel'.")
    ws["A2"].font = Font(size=10, italic=True, color="64748B")
    ws["A2"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(f"A2:{ultima_col_letra}2")
    ws.row_dimensions[2].height = 32

    borde = Border(left=Side(style="thin", color="CBD5E1"),
                   right=Side(style="thin", color="CBD5E1"),
                   top=Side(style="thin", color="CBD5E1"),
                   bottom=Side(style="thin", color="CBD5E1"))
    for i, (etiqueta, obligatorio, ancho, _ejemplo) in enumerate(COLUMNAS_ESTUDIANTES, 1):
        texto = f"{etiqueta} *" if obligatorio else etiqueta
        cel = ws.cell(row=4, column=i, value=texto)
        cel.font = Font(bold=True, color="FFFFFF", size=10)
        cel.fill = PatternFill(
            start_color="1E3A5F" if obligatorio else "475569",
            end_color="1E3A5F" if obligatorio else "475569",
            fill_type="solid",
        )
        cel.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cel.border = borde
        ws.column_dimensions[_col_letter(i)].width = ancho
    ws.row_dimensions[4].height = 42

    # Fila de ejemplo (todos los campos con ejemplo)
    for i, (_e, _o, _a, ejemplo) in enumerate(COLUMNAS_ESTUDIANTES, 1):
        cel = ws.cell(row=5, column=i, value=ejemplo)
        cel.font = Font(italic=True, color="94A3B8", size=10)
        cel.border = borde

    # Congelar la fila de cabeceras
    ws.freeze_panes = "A5"

    # Segunda hoja con instrucciones
    ws2 = wb.create_sheet("Instrucciones")
    ws2["A1"] = "INSTRUCCIONES DE USO"
    ws2["A1"].font = Font(size=14, bold=True, color="1E3A5F")
    instrucciones = [
        "1. NO borres las filas 1-4 (cabeceras).",
        "2. Empezá a llenar desde la fila 5. Reemplazá el ejemplo con datos reales.",
        "3. Las columnas con asterisco (*) son OBLIGATORIAS. Sin ellas la fila se rechaza.",
        "4. Fecha: formato AAAA-MM-DD (ej: 2010-05-15).",
        "5. Sexo: M para Masculino, F para Femenino.",
        "6. Grupo sanguíneo: O+, O-, A+, A-, B+, B-, AB+, AB-, o NS (no se sabe).",
        "7. Campos SI/NO: escribí 'SI' o 'NO' en mayúsculas.",
        "8. DNI: exactamente 8 dígitos numéricos. Si es CE u otro documento, dejalo vacío.",
        "9. Grado: usá el formato peruano estándar (1ro, 2do, 3ro, 4to, 5to).",
        "10. Al guardar, elegí formato 'Excel Workbook (*.xlsx)'. NO .xls antiguo, NO CSV.",
        "",
        "Password inicial de cada estudiante = 6 primeros dígitos del DNI + '2026'.",
        "Ejemplo: DNI 12345678 → contraseña 1234562026.",
        "",
        "Si tenés dudas escribí a soporte@sistematic.pe",
    ]
    for i, linea in enumerate(instrucciones, 3):
        ws2.cell(row=i, column=1, value=linea).font = Font(size=11)
    ws2.column_dimensions["A"].width = 100

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def _col_letter(n: int) -> str:
    """Convierte un índice de columna (1-based) a letra de Excel (A, B, …, Z, AA, AB, …)."""
    result = ""
    while n > 0:
        n, rem = divmod(n - 1, 26)
        result = chr(65 + rem) + result
    return result


COLUMNAS_PADRES = [
    ("DNI", True, 10, "87654321"),
    ("Apellidos", True, 22, "Quispe Vargas"),
    ("Nombres", True, 22, "María Elena"),
    ("Parentesco\n(padre/madre/abuelo/tio/apoderado)", False, 14, "madre"),
    ("Teléfono", False, 14, "987654321"),
    ("Correo (opcional)", False, 22, "mquispe@correo.com"),
    ("Ocupación", False, 20, "Comerciante"),
    ("Grado instrucción", False, 18, "Secundaria"),
    ("Lugar de trabajo", False, 22, "Mercado Central"),
    ("Teléfono trabajo", False, 14, ""),
    ("Prefiere WhatsApp\n(SI/NO)", False, 12, "SI"),
    ("Hijos DNI (separados por coma)", True, 30, "12345678"),
]


def template_padres() -> bytes:
    """Plantilla ampliada de padres con datos completos MINEDU."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Padres"

    n_cols = len(COLUMNAS_PADRES)
    ultima = _col_letter(n_cols)

    ws["A1"] = "PLANTILLA DE IMPORTACIÓN — PADRES / APODERADOS"
    ws["A1"].font = Font(size=13, bold=True, color="1E3A5F")
    ws.merge_cells(f"A1:{ultima}1")
    ws["A2"] = ("Una fila por padre/madre/tutor. Si el padre tiene varios hijos, "
                "listar todos los DNIs en la última columna separados por coma. "
                "Los estudiantes DEBEN estar cargados antes de subir esta plantilla.")
    ws["A2"].font = Font(size=10, italic=True, color="64748B")
    ws["A2"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(f"A2:{ultima}2")
    ws.row_dimensions[2].height = 32

    borde = Border(left=Side(style="thin", color="CBD5E1"),
                   right=Side(style="thin", color="CBD5E1"),
                   top=Side(style="thin", color="CBD5E1"),
                   bottom=Side(style="thin", color="CBD5E1"))
    for i, (etiqueta, obligatorio, ancho, _e) in enumerate(COLUMNAS_PADRES, 1):
        cel = ws.cell(row=4, column=i, value=f"{etiqueta} *" if obligatorio else etiqueta)
        cel.font = Font(bold=True, color="FFFFFF", size=10)
        cel.fill = PatternFill(
            start_color="1E3A5F" if obligatorio else "475569",
            end_color="1E3A5F" if obligatorio else "475569",
            fill_type="solid",
        )
        cel.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cel.border = borde
        ws.column_dimensions[_col_letter(i)].width = ancho
    ws.row_dimensions[4].height = 42

    for i, (_e, _o, _a, ejemplo) in enumerate(COLUMNAS_PADRES, 1):
        cel = ws.cell(row=5, column=i, value=ejemplo)
        cel.font = Font(italic=True, color="94A3B8", size=10)
        cel.border = borde

    ws.freeze_panes = "A5"

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


# ═════════════════════════════════════════════════════════════════════════════
# IMPORTACIÓN
# ═════════════════════════════════════════════════════════════════════════════

def importar_estudiantes(archivo) -> dict:
    """Recibe file-like Excel. Lee las 34 columnas de la plantilla ampliada.
    Solo DNI/Apellidos/Nombres/Grado/Sección son obligatorios; el resto se puebla si viene."""
    wb = load_workbook(archivo, data_only=True)
    ws = wb.active

    creados = 0
    actualizados = 0
    errores = []
    credenciales = []
    n = len(COLUMNAS_ESTUDIANTES)

    # DNIs de ejemplo en la plantilla (fila 5) que hay que ignorar
    DNIS_EJEMPLO_PLANTILLA = {"12345678"}

    for i, fila in enumerate(ws.iter_rows(min_row=5, values_only=True), start=5):
        if not fila or not any(fila):
            continue
        # Padear la fila hasta n columnas
        f = list(fila) + [None] * n
        # Saltear fila de ejemplo del template
        dni_check = str(f[0] or "").strip()
        if i == 5 and dni_check in DNIS_EJEMPLO_PLANTILLA:
            continue
        (dni, ap_paterno, ap_materno, nombres, codigo_siagie, fnac, sexo, grado,
         seccion_letra, codigo_mat, email, telefono, direccion, distrito, provincia,
         departamento, lugar_nac, lengua, religion, colegio_ant, fecha_ingreso,
         grupo_sang, tiene_seg, tipo_seg, alergias, medicamentos, condicion,
         em_nombre, em_parentesco, em_telefono, vive_con, n_hermanos, trabaja,
         luz, agua, internet) = f[:n]

        try:
            dni = str(dni or "").strip()
            # Detectar formato SIAGIE "APELLIDOS, Nombres" en ap_paterno
            ap_paterno_s = str(ap_paterno or "").strip()
            ap_materno_s = str(ap_materno or "").strip()
            nombres_s = str(nombres or "").strip()
            if "," in ap_paterno_s and not ap_materno_s and not nombres_s:
                partes = ap_paterno_s.split(",", 1)
                apellidos_raw = partes[0].strip().split()
                nombres_s = partes[1].strip()
                ap_paterno_s = apellidos_raw[0] if apellidos_raw else ""
                ap_materno_s = " ".join(apellidos_raw[1:]) if len(apellidos_raw) > 1 else ""
            apellidos = f"{ap_paterno_s} {ap_materno_s}".strip()
            nombres = nombres_s
            if not dni or len(dni) != 8 or not dni.isdigit():
                raise ValueError(f"DNI inválido: '{dni}'")
            if not apellidos or not nombres:
                raise ValueError("Apellidos/nombres requeridos")
            if not grado or not seccion_letra:
                raise ValueError("Grado y sección requeridos")

            grado_s = str(grado).strip()
            seccion_s = str(seccion_letra).strip().upper()
            username = f"est_{dni}"

            usuario, creado = Usuario.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": nombres_s.title() if nombres_s.isupper() else nombres_s,
                    "last_name": apellidos.title() if apellidos.isupper() else apellidos,
                    "rol": Rol.ESTUDIANTE,
                    "dni": dni,
                    "email": str(email or "").strip(),
                    "telefono": str(telefono or "").strip(),
                },
            )
            if creado:
                password = _password_inicial(dni)
                usuario.set_password(password)
                usuario.debe_cambiar_password = True
                usuario.save(update_fields=["password", "debe_cambiar_password"])
                credenciales.append({
                    "nombre": f"{apellidos}, {nombres}",
                    "usuario": username,
                    "password": password,
                    "dni": dni,
                    "rol": "Estudiante",
                })
                creados += 1
            else:
                # Actualizar campos básicos del Usuario si vinieron
                cambios = {}
                if str(email or "").strip():
                    cambios["email"] = str(email).strip()
                if str(telefono or "").strip():
                    cambios["telefono"] = str(telefono).strip()
                if cambios:
                    for k, v in cambios.items():
                        setattr(usuario, k, v)
                    usuario.save(update_fields=list(cambios.keys()))
                actualizados += 1

            # Sección
            seccion_obj, _ = Seccion.objects.get_or_create(
                grado=grado_s, letra=seccion_s,
                defaults={"nombre": f"{grado_s} {seccion_s}"},
            )

            # Validar sexo
            sexo_norm = str(sexo or "").strip().upper()
            if sexo_norm not in ("", "M", "F"):
                sexo_norm = ""

            # Validar grupo sanguíneo
            gs = str(grupo_sang or "").strip().upper().replace(" ", "")
            grupos_validos = {"O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-", "NS"}
            if gs not in grupos_validos:
                gs = "NS"

            # Estudiante: sobreescribir solo campos que vinieron con dato
            codigo_siagie_s = str(codigo_siagie or "").strip() or None
            defaults = {
                "grado": grado_s,
                "seccion": seccion_s,
                "seccion_obj": seccion_obj,
                "codigo_matricula": codigo_siagie_s or str(codigo_mat or "").strip() or None,
                "sexo": sexo_norm,
                "grupo_sanguineo": gs,
            }
            # Opcionales — solo setear si vinieron (para no borrar datos existentes)
            fnac_d = _fecha(fnac)
            if fnac_d: defaults["fecha_nacimiento"] = fnac_d
            fing_d = _fecha(fecha_ingreso)
            if fing_d: defaults["fecha_ingreso"] = fing_d

            for campo, val in [
                ("direccion", direccion), ("distrito", distrito), ("provincia", provincia),
                ("departamento", departamento), ("lugar_nacimiento", lugar_nac),
                ("lengua_materna", lengua), ("religion", religion),
                ("colegio_procedencia", colegio_ant), ("tipo_seguro", tipo_seg),
                ("alergias", alergias), ("medicamentos", medicamentos), ("condicion_medica", condicion),
                ("contacto_emergencia_nombre", em_nombre),
                ("contacto_emergencia_parentesco", em_parentesco),
                ("contacto_emergencia_telefono", em_telefono),
                ("vive_con", vive_con),
            ]:
                s = str(val or "").strip()
                if s:
                    defaults[campo] = s

            # Booleanos SI/NO
            for campo, val in [
                ("tiene_seguro", tiene_seg), ("trabaja", trabaja),
                ("tiene_luz", luz), ("tiene_agua", agua), ("tiene_internet", internet),
            ]:
                b = _si_no_bool(val)
                if b is not None:
                    defaults[campo] = b

            # N° hermanos
            try:
                if n_hermanos not in (None, ""):
                    defaults["numero_hermanos"] = int(float(n_hermanos))
            except (ValueError, TypeError):
                pass

            Estudiante.objects.update_or_create(usuario=usuario, defaults=defaults)
        except Exception as e:  # noqa: BLE001 — capturamos para reportar sin abortar
            errores.append({"fila": i, "error": str(e), "datos": [str(x) if x else "" for x in fila[:4]]})

    return {
        "creados": creados,
        "actualizados": actualizados,
        "errores": errores,
        "credenciales": credenciales,
    }


def importar_padres(archivo) -> dict:
    wb = load_workbook(archivo, data_only=True)
    ws = wb.active

    creados = 0
    actualizados = 0
    hijos_vinculados = 0
    errores = []
    credenciales = []

    n = len(COLUMNAS_PADRES)
    DNIS_EJEMPLO_PLANTILLA = {"87654321"}

    for i, fila in enumerate(ws.iter_rows(min_row=5, values_only=True), start=5):
        if not fila or not any(fila):
            continue
        f = list(fila) + [None] * n
        dni_check = str(f[0] or "").strip()
        if i == 5 and dni_check in DNIS_EJEMPLO_PLANTILLA:
            continue
        (dni, apellidos, nombres, parentesco, telefono, email, ocupacion,
         grado_inst, lugar_trabajo, tel_trabajo, prefiere_wa, hijos_dni) = f[:n]

        try:
            dni = str(dni or "").strip()
            apellidos = str(apellidos or "").strip()
            nombres = str(nombres or "").strip()
            if len(dni) != 8 or not dni.isdigit():
                raise ValueError(f"DNI inválido: '{dni}'")
            if not apellidos or not nombres:
                raise ValueError("Apellidos/nombres requeridos")

            username = f"padre_{dni}"
            usuario, creado = Usuario.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": nombres,
                    "last_name": apellidos,
                    "rol": Rol.PADRE,
                    "dni": dni,
                    "telefono": str(telefono or "").strip(),
                    "email": str(email or "").strip(),
                },
            )
            if creado:
                password = _password_inicial(dni)
                usuario.set_password(password)
                usuario.debe_cambiar_password = True
                usuario.save(update_fields=["password", "debe_cambiar_password"])
                credenciales.append({
                    "nombre": f"{apellidos}, {nombres}",
                    "usuario": username,
                    "password": password,
                    "dni": dni,
                    "rol": "Padre",
                })
                creados += 1
            else:
                actualizados += 1

            # Normalizar parentesco
            par = str(parentesco or "").strip().lower()
            parentescos_validos = {"padre", "madre", "abuelo", "tio", "hermano", "apoderado", "otro"}
            if par not in parentescos_validos:
                par = ""

            padre, _ = Padre.objects.get_or_create(usuario=usuario)
            # Campos opcionales
            cambios_padre = {}
            if par: cambios_padre["parentesco"] = par
            for campo, val in [
                ("ocupacion", ocupacion), ("grado_instruccion", grado_inst),
                ("lugar_trabajo", lugar_trabajo), ("telefono_trabajo", tel_trabajo),
            ]:
                s = str(val or "").strip()
                if s:
                    cambios_padre[campo] = s
            b = _si_no_bool(prefiere_wa)
            if b is not None:
                cambios_padre["prefiere_whatsapp"] = b
            for k, v in cambios_padre.items():
                setattr(padre, k, v)
            if cambios_padre:
                padre.save()

            # Vincular hijos por DNI
            if hijos_dni:
                dnis_hijos = [d.strip() for d in str(hijos_dni).split(",") if d.strip()]
                for d in dnis_hijos:
                    est = Estudiante.objects.filter(usuario__dni=d).first()
                    if est:
                        padre.hijos.add(est)
                        hijos_vinculados += 1
                    else:
                        errores.append({"fila": i, "error": f"Hijo con DNI {d} no encontrado (aún)."})
        except Exception as e:
            errores.append({"fila": i, "error": str(e), "datos": [str(x) if x else "" for x in fila[:3]]})

    return {
        "creados": creados,
        "actualizados": actualizados,
        "hijos_vinculados": hijos_vinculados,
        "errores": errores,
        "credenciales": credenciales,
    }


# ═════════════════════════════════════════════════════════════════════════════
# EXCEL DE CREDENCIALES
# ═════════════════════════════════════════════════════════════════════════════

def credenciales_a_excel(credenciales: list) -> bytes:
    """Genera Excel imprimible con las credenciales generadas."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Credenciales"

    ws["A1"] = "CREDENCIALES DE ACCESO — Sistema TIC"
    ws["A1"].font = Font(size=14, bold=True, color="1E3A5F")
    ws.merge_cells("A1:E1")
    ws["A2"] = f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}  ·  Guardar y entregar a cada usuario. Cambiar la contraseña al primer ingreso."
    ws.merge_cells("A2:E2")

    cabeceras = ["N°", "Rol", "Nombre", "Usuario", "Contraseña inicial"]
    borde = Border(left=Side(style="thin", color="CBD5E1"),
                   right=Side(style="thin", color="CBD5E1"),
                   top=Side(style="thin", color="CBD5E1"),
                   bottom=Side(style="thin", color="CBD5E1"))
    for i, c in enumerate(cabeceras, 1):
        cel = ws.cell(row=4, column=i, value=c)
        cel.font = Font(bold=True, color="FFFFFF")
        cel.fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
        cel.alignment = Alignment(horizontal="center", vertical="center")
        cel.border = borde

    for col, ancho in zip("ABCDE", [6, 15, 40, 20, 20]):
        ws.column_dimensions[col].width = ancho

    for idx, c in enumerate(credenciales, 1):
        fila = 4 + idx
        valores = [idx, c["rol"], c["nombre"], c["usuario"], c["password"]]
        for col, v in enumerate(valores, 1):
            cel = ws.cell(row=fila, column=col, value=v)
            cel.border = borde
            if idx % 2 == 0:
                cel.fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


# ═════════════════════════════════════════════════════════════════════════════
# DOCENTES — Template + Importar masivo
# ═════════════════════════════════════════════════════════════════════════════

COLUMNAS_DOCENTES = [
    # (etiqueta, obligatorio, ancho, ejemplo)
    ("DNI", True, 10, "12345678"),
    ("Apellidos", True, 22, "García Pérez"),
    ("Nombres", True, 22, "Ana María"),
    ("Correo institucional", False, 26, "ana.garcia@colegio.edu.pe"),
    ("Teléfono", False, 14, "987654321"),
    ("Especialidad", False, 26, "Matemática"),
    ("Nivel\n(Inicial/Primaria/Secundaria)", False, 16, "Primaria"),
    ("Fecha ingreso\n(AAAA-MM-DD)", False, 16, "2020-03-01"),
    ("Sección tutor\n(ej: 5to A, o vacío)", False, 18, ""),
]


def template_docentes() -> bytes:
    """Plantilla para importar docentes en lote."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Docentes"

    n_cols = len(COLUMNAS_DOCENTES)
    ultima_col_letra = _col_letter(n_cols)

    ws["A1"] = "PLANTILLA DE IMPORTACIÓN — DOCENTES"
    ws["A1"].font = Font(size=13, bold=True, color="1E3A5F")
    ws.merge_cells(f"A1:{ultima_col_letra}1")

    ws["A2"] = ("Complete una fila por docente. Columnas con * son obligatorias. "
                "Al importar, cada docente recibirá username = 'd' + 6 primeros dígitos del DNI, "
                "y contraseña inicial = DNI + '2026'. Puedes editar todo después en el sistema.")
    ws["A2"].font = Font(size=10, italic=True, color="64748B")
    ws["A2"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(f"A2:{ultima_col_letra}2")
    ws.row_dimensions[2].height = 42

    borde = Border(left=Side(style="thin", color="CBD5E1"),
                   right=Side(style="thin", color="CBD5E1"),
                   top=Side(style="thin", color="CBD5E1"),
                   bottom=Side(style="thin", color="CBD5E1"))
    for i, (etiqueta, obligatorio, ancho, _ej) in enumerate(COLUMNAS_DOCENTES, 1):
        texto = f"{etiqueta} *" if obligatorio else etiqueta
        cel = ws.cell(row=4, column=i, value=texto)
        cel.font = Font(bold=True, color="FFFFFF", size=10)
        cel.fill = PatternFill(
            start_color="1E3A5F" if obligatorio else "475569",
            end_color="1E3A5F" if obligatorio else "475569",
            fill_type="solid",
        )
        cel.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cel.border = borde
        ws.column_dimensions[_col_letter(i)].width = ancho
    ws.row_dimensions[4].height = 42

    for i, (_e, _o, _a, ejemplo) in enumerate(COLUMNAS_DOCENTES, 1):
        cel = ws.cell(row=5, column=i, value=ejemplo)
        cel.font = Font(italic=True, color="94A3B8", size=10)
        cel.border = borde

    ws.freeze_panes = "A5"

    # Instrucciones
    ws2 = wb.create_sheet("Instrucciones")
    ws2["A1"] = "INSTRUCCIONES DE USO"
    ws2["A1"].font = Font(size=14, bold=True, color="1E3A5F")
    instrucciones = [
        "1. NO borres las filas 1-4 (cabeceras).",
        "2. Empezá a llenar desde la fila 5. Reemplazá el ejemplo con datos reales.",
        "3. Las columnas con asterisco (*) son OBLIGATORIAS.",
        "4. DNI: 8 dígitos exactos. Si es CE, escribe los últimos 8.",
        "5. Fecha: formato AAAA-MM-DD (ej: 2020-03-01).",
        "6. Nivel: Inicial, Primaria o Secundaria (opcional).",
        "7. Sección tutor: si el docente será tutor de una sección, escribe el nombre (ej: '5to A').",
        "",
        "Username generado: 'd' + 6 primeros dígitos del DNI.",
        "  Ejemplo: DNI 12345678 → username d123456",
        "Password inicial: DNI + '2026' (ej: 123456782026). Se puede cambiar al primer login.",
        "",
        "Si un DNI ya existe en el sistema, esa fila se OMITE (no duplica).",
        "",
        "Si tenés dudas escribí a soporte@sistematic.pe",
    ]
    for i, linea in enumerate(instrucciones, 3):
        ws2.cell(row=i, column=1, value=linea).font = Font(size=11)
    ws2.column_dimensions["A"].width = 100

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def importar_docentes(archivo) -> dict:
    """Lee Excel de docentes y crea Usuario + Docente. Idempotente por DNI.

    Devuelve resumen: {creados, omitidos, errores: [{fila, mensaje}], credenciales: [...]}
    """
    wb = load_workbook(archivo, read_only=False, data_only=True)
    ws = wb["Docentes"] if "Docentes" in wb.sheetnames else wb.active

    creados = 0
    omitidos = 0
    errores: list = []
    credenciales: list = []

    # Empezamos desde fila 5 (1-4 son título+instrucción+cabecera+ejemplo)
    for row_idx in range(5, ws.max_row + 1):
        fila = [ws.cell(row=row_idx, column=c).value for c in range(1, len(COLUMNAS_DOCENTES) + 1)]
        if not any(fila):
            continue

        try:
            dni = str(fila[0] or "").strip().replace(".0", "")
            apellidos = str(fila[1] or "").strip()
            nombres = str(fila[2] or "").strip()
            email = str(fila[3] or "").strip()
            telefono = str(fila[4] or "").strip()
            especialidad = str(fila[5] or "").strip()
            nivel = str(fila[6] or "").strip()
            fecha_ingreso = _fecha(fila[7])
            seccion_tutor_str = str(fila[8] or "").strip()

            # Ejemplo se salta
            if dni == "12345678" and nombres == "Ana María":
                continue

            if not dni or not apellidos or not nombres:
                errores.append({"fila": row_idx, "mensaje": "Faltan DNI / Apellidos / Nombres."})
                continue

            if len(dni) < 6:
                errores.append({"fila": row_idx, "mensaje": f"DNI '{dni}' inválido (mínimo 6 dígitos)."})
                continue

            # Idempotente: si existe usuario con ese DNI, omitir
            if Usuario.objects.filter(dni=dni).exists():
                omitidos += 1
                continue

            username = "d" + dni[:6]
            base_username = username
            n = 1
            while Usuario.objects.filter(username=username).exists():
                n += 1
                username = f"{base_username}{n}"

            password = f"{dni}2026"

            usuario = Usuario(
                username=username,
                rol=Rol.DOCENTE,
                first_name=nombres,
                last_name=apellidos,
                email=email,
                dni=dni,
                telefono=telefono,
            )
            usuario.set_password(password)
            usuario.debe_cambiar_password = True
            usuario.save(update_fields=["password", "debe_cambiar_password"])

            # Perfil docente
            especialidad_final = especialidad
            if nivel and especialidad:
                especialidad_final = f"{especialidad} ({nivel})"
            elif nivel:
                especialidad_final = nivel

            Docente.objects.create(
                usuario=usuario,
                especialidad=especialidad_final[:100],
                fecha_ingreso=fecha_ingreso,
            )

            # Si se indicó sección tutor, buscarla e intentar asignar
            if seccion_tutor_str:
                sec = Seccion.objects.filter(nombre__iexact=seccion_tutor_str).first()
                if sec and not sec.tutor_id:
                    sec.tutor = usuario
                    sec.save(update_fields=["tutor"])

            credenciales.append({
                "rol": "Docente",
                "nombre": f"{apellidos}, {nombres}",
                "usuario": username,
                "password": password,
            })
            creados += 1

        except Exception as e:
            errores.append({"fila": row_idx, "mensaje": str(e)[:200]})

    return {
        "creados": creados,
        "omitidos_por_dni_repetido": omitidos,
        "errores": errores,
        "credenciales": credenciales,
    }
