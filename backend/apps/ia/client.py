"""Cliente LLM unificado con litellm + retries + tracking de uso.
Reciclado de p_02_automatizacion/apps/llm/client.py, sin capa de organización."""
import json
import time
from decimal import Decimal
from typing import Optional

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from .models import LLMConfig, LLMUsage
from .providers import LITELLM_PREFIX, PROVIDERS_NATIVOS


def _litellm():
    import litellm as _ll  # noqa: PLC0415
    _ll.drop_params = True
    _ll.set_verbose = False
    return _ll


class LLMClient:
    def __init__(self, config: LLMConfig, endpoint: str = "unknown", usuario=None):
        self.config = config
        self.endpoint = endpoint
        self.usuario = usuario
        self.con_config_propia = (config.usuario_id is not None)

    def _modelo_litellm(self, override: Optional[str] = None) -> str:
        modelo = override or self.config.modelo_default
        prefijo = LITELLM_PREFIX.get(self.config.provider, "")
        if not prefijo or modelo.startswith(prefijo):
            return modelo
        return f"{prefijo}{modelo}"

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type((Exception,)),
        reraise=True,
    )
    def _llamar_bruto(self, modelo, mensajes, **kwargs):
        ll = _litellm()
        base = None if self.config.provider in PROVIDERS_NATIVOS else (self.config.base_url or None)
        return ll.completion(
            model=modelo,
            api_key=self.config.api_key or "no-key",
            api_base=base,
            messages=mensajes,
            **kwargs,
        )

    def completar(
        self,
        prompt: str,
        sistema: Optional[str] = None,
        modelo: Optional[str] = None,
        response_format=None,
        max_tokens: int = 2000,
        timeout: int = 60,
        **kwargs,
    ) -> str:
        mensajes = []
        if sistema:
            mensajes.append({"role": "system", "content": sistema})
        mensajes.append({"role": "user", "content": prompt})

        modelo_final = self._modelo_litellm(modelo)
        params = {"max_tokens": max_tokens, "timeout": timeout, **kwargs}
        if response_format:
            params["response_format"] = response_format

        t0 = time.time()
        ok, error = True, ""
        resp = None
        try:
            resp = self._llamar_bruto(modelo_final, mensajes, **params)
        except Exception as e:
            ok, error = False, str(e)[:500]
            raise
        finally:
            latencia = int((time.time() - t0) * 1000)
            self._registrar_uso(resp, modelo_final, ok, error, latencia)

        return resp.choices[0].message.content

    def completar_chat(
        self,
        mensajes: list,
        max_tokens: int = 1000,
        timeout: int = 60,
    ) -> str:
        """Multi-turno: `mensajes` es lista de dicts {role, content} ya listos para la API."""
        modelo_final = self._modelo_litellm(None)
        t0 = time.time()
        ok, error = True, ""
        resp = None
        try:
            resp = self._llamar_bruto(modelo_final, mensajes, max_tokens=max_tokens, timeout=timeout)
        except Exception as e:
            ok, error = False, str(e)[:500]
            raise
        finally:
            self._registrar_uso(resp, modelo_final, ok, error, int((time.time() - t0) * 1000))
        return resp.choices[0].message.content

    def completar_json(self, prompt: str, sistema: Optional[str] = None, **kwargs) -> dict:
        raw = self.completar(
            prompt,
            sistema=sistema,
            response_format={"type": "json_object"},
            **kwargs,
        )
        return json.loads(raw)

    def _registrar_uso(self, resp, modelo, ok, error, latencia):
        try:
            usage = getattr(resp, "usage", None) if ok and resp else None
            costo = Decimal("0")
            if ok and resp:
                try:
                    costo = Decimal(str(_litellm().completion_cost(completion_response=resp)))
                except Exception:
                    pass
            LLMUsage.objects.create(
                usuario=self.usuario if self.usuario and getattr(self.usuario, "is_authenticated", False) else None,
                con_config_propia=self.con_config_propia,
                provider=self.config.provider,
                modelo=modelo,
                endpoint=self.endpoint,
                tokens_in=(usage.prompt_tokens if usage else 0),
                tokens_out=(usage.completion_tokens if usage else 0),
                costo_usd=costo,
                latencia_ms=latencia,
                ok=ok,
                error=error,
            )
        except Exception as e:  # noqa: BLE001
            import logging
            logging.getLogger(__name__).warning("No se registró LLMUsage: %s", e)


def get_client(endpoint: str = "unknown", usuario=None) -> Optional[LLMClient]:
    """Devuelve el cliente configurado para este usuario.
    Prioriza config personal (BYOK) sobre la institucional. None si no hay ninguna."""
    config = LLMConfig.get_para(usuario) if usuario else LLMConfig.get_activa()
    if config is None:
        return None
    return LLMClient(config, endpoint=endpoint, usuario=usuario)
