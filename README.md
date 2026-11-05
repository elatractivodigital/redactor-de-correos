# redactor-de-correos — Asistente de Redacción Docente

Mini-aplicación web diseñada para ayudar al profesorado a transformar ideas cotidianas, apuntes sueltos o borradores rápidos en comunicaciones escolares claras, empáticas y formalmente estructuradas en **4 pasos guiados**.

## Características principales

- **Flujo guiado en 4 pasos:**
  1. **Encabezado:** Remitente, destinatario y asunto inicial.
  2. **Tu idea:** Explicación en lenguaje natural o selección de plantillas frecuentes.
  3. **Documento de apoyo (100% opcional):** Lectura local y privada en el navegador de archivos `.PDF` y `.DOCX` con 3 modos de análisis:
     - **Opción A:** Clonar tono y estilo personal (ignorando el contenido temático del archivo).
     - **Opción B:** Utilizar el documento como base directa de contenido.
     - **Opción C:** Análisis de alta formalidad para gestión administrativa o normativa.
  4. **Revisión y creación:** Resumen previo y generación del correo.
- **Lienzo de edición en vivo:** Permite editar cualquier palabra o párrafo directamente sobre el borrador generado antes de exportarlo.
- **Exportación directa:** Copia al portapapeles en un clic o descarga inmediata en formato Word (`.DOCX`) y documento `.PDF`.
- **Modo Claro y Modo Oscuro:** Paleta diseñada para reducir la fatiga visual («Calma y Enfoque» en modo claro y «Cero Fatiga Visual» por elevación lumínica en modo oscuro).

## Cómo usar la aplicación

### Opción 1: Uso directo en el navegador (sin instalación)
Abre directamente el archivo `index.html` en cualquier navegador moderno (Chrome, Edge, Firefox o Safari).

### Opción 2: Servidor local con IA opcional (`GEMINI_API_KEY`)
Si deseas conectar el motor con la API de Gemini mediante variables de entorno (sin guardar nunca claves en el código):

1. Copia el archivo `.env.example` como `.env` (este archivo está excluido de Git mediante `.gitignore`) o define la variable de entorno en tu terminal:
   ```powershell
   $env:GEMINI_API_KEY="tu_clave_aqui"
   python server.py
   ```
2. Abre `http://localhost:8080` en tu navegador (o ejecuta `Iniciar_App.bat` en Windows).
