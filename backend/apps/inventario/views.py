import io

from django.db.models import Count, Sum
from django.http import HttpResponse
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.usuarios.models import Rol

from .models import Equipo, EstadoEquipo, TipoEquipo
from .serializers import EquipoSerializer


class PermisoInventario(IsAuthenticated):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        # Escritura: solo admin_tic y director
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            return request.user.rol in (Rol.ADMIN_TIC, Rol.DIRECTOR)
        return True


class EquipoViewSet(viewsets.ModelViewSet):
    queryset = Equipo.objects.all().order_by("ubicacion", "codigo_inventario")
    serializer_class = EquipoSerializer
    permission_classes = [PermisoInventario]

    def get_queryset(self):
        qs = super().get_queryset()
        for campo in ("estado", "tipo", "ubicacion"):
            v = self.request.GET.get(campo)
            if v:
                qs = qs.filter(**{campo: v})
        ambiente = self.request.GET.get("ambiente")
        if ambiente:
            qs = qs.filter(ambiente_id=ambiente)
        ambiente_tipo = self.request.GET.get("ambiente_tipo")
        if ambiente_tipo:
            qs = qs.filter(ambiente__tipo=ambiente_tipo)
        return qs

    @action(detail=True, methods=["get"], url_path="qr")
    def qr_equipo(self, request, pk=None):
        """PNG del QR del equipo."""
        import io
        import qrcode
        from django.http import HttpResponse
        eq = self.get_object()
        img = qrcode.make(eq.codigo_inventario, box_size=8, border=2)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return HttpResponse(buf.getvalue(), content_type="image/png")

    @action(detail=False, methods=["get"], url_path="por-codigo/(?P<codigo>[^/]+)")
    def por_codigo(self, request, codigo=None):
        """Devuelve la ficha del equipo por código de inventario (al escanear QR)."""
        eq = Equipo.objects.filter(codigo_inventario=codigo).first()
        if not eq:
            return Response({"error": "Equipo no encontrado."}, status=404)
        return Response(EquipoSerializer(eq).data)

    @action(detail=False, methods=["get"], url_path="etiquetas-pdf")
    def etiquetas_pdf(self, request):
        """Genera PDF con etiquetas QR (10 por hoja A4) para imprimir y pegar."""
        import io
        import qrcode
        from django.http import HttpResponse
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.units import mm
            from reportlab.pdfgen import canvas
            from reportlab.lib.utils import ImageReader
        except ImportError:
            return Response({"error": "reportlab no está instalado."}, status=500)

        if request.user.rol not in (Rol.DIRECTOR, Rol.ADMIN_TIC):
            raise PermissionDenied()

        from apps.core.models import ConfiguracionInstitucional
        cfg_ie = ConfiguracionInstitucional.get_solo()
        nombre_ie_corto = cfg_ie.nombre_institucion or "I.E."
        if len(nombre_ie_corto) > 30:
            nombre_ie_corto = nombre_ie_corto[:30] + "…"

        qs = self.get_queryset()
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        ancho, alto = A4
        cols, filas = 2, 5
        margen = 15 * mm
        et_ancho = (ancho - 2 * margen) / cols
        et_alto = (alto - 2 * margen) / filas

        for idx, eq in enumerate(qs):
            pos = idx % (cols * filas)
            col = pos % cols
            fila = pos // cols
            x = margen + col * et_ancho
            y = alto - margen - (fila + 1) * et_alto

            qr_img = qrcode.make(eq.codigo_inventario, box_size=6, border=1)
            qr_buf = io.BytesIO()
            qr_img.save(qr_buf, format="PNG")
            qr_buf.seek(0)
            c.drawImage(ImageReader(qr_buf), x + 5 * mm, y + 10 * mm, 30 * mm, 30 * mm)

            c.setFont("Helvetica-Bold", 9)
            c.drawString(x + 40 * mm, y + 35 * mm, eq.codigo_inventario)
            c.setFont("Helvetica", 7)
            c.drawString(x + 40 * mm, y + 30 * mm, f"{eq.get_tipo_display()}")
            c.drawString(x + 40 * mm, y + 26 * mm, f"{eq.marca} {eq.modelo}"[:35])
            c.drawString(x + 40 * mm, y + 22 * mm, f"Ubic: {eq.ubicacion}"[:35])
            c.drawString(x + 40 * mm, y + 18 * mm, nombre_ie_corto)
            c.rect(x + 2 * mm, y + 5 * mm, et_ancho - 4 * mm, et_alto - 10 * mm)

            if (idx + 1) % (cols * filas) == 0:
                c.showPage()

        c.save()
        resp = HttpResponse(buf.getvalue(), content_type="application/pdf")
        resp["Content-Disposition"] = 'attachment; filename="etiquetas_qr_inventario.pdf"'
        return resp

    @action(detail=False, methods=["get"], url_path="por-ambiente")
    def por_ambiente(self, request):
        """Devuelve conteo de equipos por ambiente + resumen."""
        from apps.ambientes.models import Ambiente
        ambientes = Ambiente.objects.filter(activo=True).order_by("tipo", "nombre")
        resultado = []
        for a in ambientes:
            eqs = Equipo.objects.filter(ambiente=a)
            resultado.append({
                "ambiente_id": a.pk,
                "codigo": a.codigo,
                "nombre": a.nombre,
                "tipo": a.tipo,
                "tipo_label": a.get_tipo_display(),
                "total": eqs.count(),
                "operativos": eqs.filter(estado="operativo").count(),
                "por_estado": {c: eqs.filter(estado=c).count() for c, _ in EstadoEquipo.choices},
                "valor_total": float(eqs.aggregate(v=Sum("valor_referencial"))["v"] or 0),
            })
        return Response(resultado)

    @action(detail=False, methods=["get"], url_path="kpis")
    def kpis(self, request):
        qs = Equipo.objects.all()
        total = qs.count()
        por_estado = {c: qs.filter(estado=c).count() for c, _ in EstadoEquipo.choices}
        por_tipo = {c: qs.filter(tipo=c).count() for c, _ in TipoEquipo.choices}
        por_ubicacion = list(
            qs.values("ubicacion").annotate(c=Count("id")).order_by("-c")[:10]
        )
        valor_total = qs.aggregate(v=Sum("valor_referencial"))["v"] or 0
        return Response({
            "total": total,
            "por_estado": por_estado,
            "por_tipo": {k: v for k, v in por_tipo.items() if v > 0},
            "por_ubicacion_top10": [{"ubicacion": r["ubicacion"], "count": r["c"]} for r in por_ubicacion],
            "valor_total_estimado": float(valor_total),
        })

    @action(detail=False, methods=["get"], url_path="exportar-excel")
    def exportar_excel(self, request):
        if request.user.rol not in (Rol.DIRECTOR, Rol.ADMIN_TIC):
            raise PermissionDenied("Solo director o admin TIC.")

        qs = self.get_queryset()
        wb = Workbook()
        ws = wb.active
        ws.title = "Inventario TIC"

        ws["A1"] = "I.E. C.N. CÉSAR VALLEJO DE PAUCARBAMBA"
        ws["A2"] = "Inventario de Activos TIC"
        ws["A3"] = f"Generado: {timezone.now().strftime('%d/%m/%Y %H:%M')}  ·  Total: {qs.count()} equipos"
        ws["A1"].font = Font(size=14, bold=True, color="1E3A5F")
        ws["A2"].font = Font(size=12, bold=True, color="1E3A5F")
        ws["A3"].font = Font(size=10)
        ws.merge_cells("A1:J1")
        ws.merge_cells("A2:J2")
        ws.merge_cells("A3:J3")

        columnas = [
            ("Código", 14), ("Tipo", 18), ("Marca", 15), ("Modelo", 20),
            ("N° Serie", 18), ("Ubicación", 20), ("Estado", 14),
            ("Adquisición", 14), ("Valor (S/)", 12), ("Observaciones", 30),
        ]
        borde = Border(left=Side(style="thin", color="CBD5E1"),
                       right=Side(style="thin", color="CBD5E1"),
                       top=Side(style="thin", color="CBD5E1"),
                       bottom=Side(style="thin", color="CBD5E1"))
        for i, (t, ancho) in enumerate(columnas, 1):
            c = ws.cell(row=5, column=i, value=t)
            c.font = Font(bold=True, color="FFFFFF", size=11)
            c.fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.border = borde
            ws.column_dimensions[c.column_letter].width = ancho
        ws.row_dimensions[5].height = 24

        tipo_map = dict(TipoEquipo.choices)
        estado_map = dict(EstadoEquipo.choices)
        for idx, eq in enumerate(qs, 1):
            fila = 5 + idx
            valores = [
                eq.codigo_inventario, tipo_map.get(eq.tipo, eq.tipo), eq.marca, eq.modelo,
                eq.numero_serie, eq.ubicacion, estado_map.get(eq.estado, eq.estado),
                eq.fecha_adquisicion.strftime("%d/%m/%Y") if eq.fecha_adquisicion else "",
                float(eq.valor_referencial) if eq.valor_referencial else 0,
                eq.observaciones,
            ]
            for col, v in enumerate(valores, 1):
                c = ws.cell(row=fila, column=col, value=v)
                c.border = borde
                if idx % 2 == 0:
                    c.fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
        ws.freeze_panes = "A6"

        out = io.BytesIO()
        wb.save(out)
        resp = HttpResponse(out.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        nombre = f"inventario_{timezone.now().strftime('%Y-%m-%d')}.xlsx"
        resp["Content-Disposition"] = f'attachment; filename="{nombre}"'
        return resp
