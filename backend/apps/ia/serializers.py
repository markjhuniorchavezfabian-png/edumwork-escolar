from rest_framework import serializers
from .models import LLMConfig, LLMUsage
from .providers import PROVIDERS, MODELOS_SUGERIDOS, MODELO_RECOMENDADO, BASE_URL_DEFAULT, MODELO_DEFAULT
from .crypto import cifrar


class LLMConfigSerializer(serializers.ModelSerializer):
    api_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    key_enmascarada = serializers.SerializerMethodField()

    class Meta:
        model = LLMConfig
        fields = [
            "id", "provider", "modelo_default", "base_url",
            "activo", "ultima_prueba_ok", "ultima_prueba_en",
            "api_key", "key_enmascarada", "actualizado_en",
        ]
        read_only_fields = ["id", "ultima_prueba_ok", "ultima_prueba_en", "actualizado_en"]

    def get_key_enmascarada(self, obj):
        return obj.key_enmascarada if obj.api_key_cifrada else ""

    def validate_provider(self, value):
        codigos = [p[0] for p in PROVIDERS]
        if value not in codigos:
            raise serializers.ValidationError(f"Proveedor inválido. Opciones: {codigos}")
        return value

    def create(self, validated_data):
        api_key = validated_data.pop("api_key", "")
        provider = validated_data["provider"]
        # Defaults automáticos si el usuario no los da
        if not validated_data.get("base_url"):
            validated_data["base_url"] = BASE_URL_DEFAULT.get(provider, "")
        if not validated_data.get("modelo_default"):
            validated_data["modelo_default"] = MODELO_DEFAULT.get(provider, "")
        # Solo una config activa: si esta viene activa, desactivar las otras
        if validated_data.get("activo", True):
            LLMConfig.objects.filter(activo=True).update(activo=False)
        cfg = LLMConfig.objects.create(
            api_key_cifrada=cifrar(api_key) if api_key else "",
            **validated_data,
        )
        return cfg

    def update(self, instance, validated_data):
        api_key = validated_data.pop("api_key", None)
        if api_key:
            instance.api_key_cifrada = cifrar(api_key)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if instance.activo:
            LLMConfig.objects.filter(activo=True).exclude(pk=instance.pk).update(activo=False)
        instance.save()
        return instance


class LLMUsageSerializer(serializers.ModelSerializer):
    class Meta:
        model = LLMUsage
        fields = [
            "id", "provider", "modelo", "endpoint",
            "tokens_in", "tokens_out", "costo_usd",
            "latencia_ms", "ok", "error", "creado_en",
        ]


class ProviderInfoSerializer(serializers.Serializer):
    """Info estática de proveedores soportados — para el selector del frontend."""
    codigo = serializers.CharField()
    etiqueta = serializers.CharField()
    base_url_default = serializers.CharField()
    modelo_default = serializers.CharField()
    modelos_sugeridos = serializers.ListField(child=serializers.CharField())


def catalogo_proveedores():
    return [
        {
            "codigo": p[0],
            "etiqueta": p[1],
            "base_url_default": p[2],
            "modelo_default": p[3],
            "modelos_sugeridos": MODELOS_SUGERIDOS.get(p[0], []),
            "modelo_recomendado": MODELO_RECOMENDADO.get(p[0], ""),
        }
        for p in PROVIDERS
    ]
