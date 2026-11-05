#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor local para la Mini App Asistente de Redacción Docente.
- Sirve los archivos estáticos de la aplicación en http://127.0.0.1:8080
- Expone POST /api/generate que utiliza variables de entorno (GEMINI_API_KEY)
  si están configuradas en el sistema o en un archivo local .env (ignorado en Git).
- Nunca almacena claves, contraseñas ni tokens en el código.
"""

import json
import os
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def load_local_env_file():
    """Carga variables desde .env si existe, sin sobrescribir variables del sistema."""
    env_path = BASE_DIR / ".env"
    if not env_path.is_file():
        return
    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val
    except Exception:
        pass


SYSTEM_PROMPT_MASTER = """# SYSTEM PROMPT INTERNO: MOTOR DE REDACCIÓN DOCENTE

## 1. ROL Y PROPÓSITO
Eres un Asistente Experto en Comunicación Institucional y Redacción Educativa. Tu única función es transformar apuntes coloquiales, ideas sueltas o borradores escritos por profesores en correos electrónicos claros, empáticos, seguros y profesionalmente estructurados, eliminando cualquier rastro de duda, nerviosismo o ambigüedad.

## 2. REGLAS DE PROCESAMIENTO SEGÚN EL MODO DE DOCUMENTO
Evalúa el valor de {{modo_documento}} y aplica estrictamente una de las siguientes cuatro lógicas:
- CASO 1: SIN_DOCUMENTO -> Toma únicamente la intención de {{idea_coloquial}} y traduce las expresiones informales o nerviosas a un registro profesional, cordial y asertivo propio del ámbito educativo.
- CASO 2: OPCION_A_TONO -> Analiza {{texto_documento}} exclusivamente desde el punto de vista estilístico. REGLA CRÍTICA: Ignora y descarta el 100% de la información temática, fechas, nombres o datos contenidos en {{texto_documento}}. No menciones nada de su contenido. Redacta el mensaje basándote solo en los hechos de {{idea_coloquial}}, pero imitando la voz y forma de expresarse detectada.
- CASO 3: OPCION_B_CONTENIDO -> Utiliza {{idea_coloquial}} como directriz principal y extrae de {{texto_documento}} los datos clave, fechas, acuerdos, actividades o puntos relevantes que respaldan ese mensaje.
- CASO 4: OPCION_C_ADMINISTRATIVO -> Analiza {{texto_documento}} en profundidad y crúzalo con la solicitud de {{idea_coloquial}} para construir un correo de alta formalidad administrativa (Contexto / Fundamento o Antecedentes / Solicitud o Resolución).

## 3. ESTRUCTURA OBLIGATORIA DE SALIDA
**Asunto:** [Versión optimizada, clara y profesional basada en {{asunto_base}}]

[Saludo formal o cordial adaptado a {{nombre_destinatario}}],

[Párrafo de apertura contextualizando el motivo del mensaje con serenidad y claridad].

[Cuerpo principal del correo donde se desarrolla {{idea_coloquial}} aplicando la regla de {{modo_documento}} correspondiente. Utiliza párrafos breves y bien espaciados].

[Párrafo de cierre indicando disponibilidad, pasos a seguir o agradecimiento por la acogida].

[Despedida profesional],

**{{nombre_remitente}}**

## 4. RESTRICCIONES ESTRICTAS
1. Cero texto conversacional externo.
2. Cero invención de datos críticos: si falta un dato puntual imprescindible usa [indicar fecha/hora].
3. Transformación emocional: neutraliza inseguridad, disculpas excesivas, frustración o enojo."""


class TeacherAppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_POST(self):
        if self.path != "/api/generate":
            self.send_error(404, "Ruta no encontrada")
            return

        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"

        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError:
            self._send_json(400, {"usedEnvModel": False, "error": "JSON inválido"})
            return

        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            # Sin clave en variables de entorno: el frontend utiliza el motor local determinista
            self._send_json(200, {"usedEnvModel": False})
            return

        variables = payload.get("variables", {})
        user_prompt = (
            f"- {{{{nombre_remitente}}}}: {variables.get('nombre_remitente', '')}\n"
            f"- {{{{nombre_destinatario}}}}: {variables.get('nombre_destinatario', '')}\n"
            f"- {{{{asunto_base}}}}: {variables.get('asunto_base', '')}\n"
            f"- {{{{idea_coloquial}}}}: {variables.get('idea_coloquial', '')}\n"
            f"- {{{{modo_documento}}}}: {variables.get('modo_documento', 'SIN_DOCUMENTO')}\n"
            f"- {{{{texto_documento}}}}: {variables.get('texto_documento', '')}\n"
        )

        model_name = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash").strip()
        endpoint = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model_name}:generateContent?key={api_key}"
        )

        req_data = {
            "system_instruction": {"parts": [{"text": SYSTEM_PROMPT_MASTER}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": {"temperature": 0.35},
        }

        try:
            req = urllib.request.Request(
                endpoint,
                data=json.dumps(req_data).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                resp_json = json.loads(resp.read().decode("utf-8"))
                candidates = resp_json.get("candidates", [])
                text_out = (
                    candidates[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                    .strip()
                    if candidates
                    else ""
                )
                if text_out:
                    self._send_json(200, {"usedEnvModel": True, "fullOutput": text_out})
                    return
        except Exception as exc:
            self._send_json(200, {"usedEnvModel": False, "fallbackReason": str(exc)})
            return

        self._send_json(200, {"usedEnvModel": False})

    def _send_json(self, status_code, data):
        encoded = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


if __name__ == "__main__":
    load_local_env_file()
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("127.0.0.1", port), TeacherAppHandler)
    print(f"Servidor activo en http://localhost:{port}")
    server.serve_forever()
