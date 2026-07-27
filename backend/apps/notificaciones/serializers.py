from rest_framework import serializers
from .models import Notificacion, PreferenciasNotificacion


class NotificacionSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = Notificacion
        fields = ["id", "tipo", "tipo_label", "titulo", "cuerpo", "url_accion",
                  "leida", "fecha_leida", "canales_enviados", "creado_en"]


class PreferenciasNotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreferenciasNotificacion
        exclude = ["id", "usuario"]
