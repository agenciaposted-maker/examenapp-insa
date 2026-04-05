# ExamenApp - Sistema de Evaluacion Digital

Sistema completo para crear y aplicar examenes digitales, con evaluacion automatica y sistema anti-trampa.

## Caracteristicas

### Panel Docente (`examendocente-1.html`)
- Carga documentos Word (.docx) o PDF con preguntas
- Deteccion automatica de tipos de preguntas (multiple, V/F, desarrollo, completar, calculo)
- 6 estrategias de parsing para diferentes formatos
- Editor de preguntas, respuestas y palabras clave
- Exporta examenes como JSON protegidos con contrasena
- Genera formato imprimible (HTML) con espacios para respuestas

### Aplicacion Alumno (`examenalumno.html`)
- **PWA instalable** - Funciona como app nativa en moviles y PC
- **Funciona offline** - Una vez cargada, no necesita internet
- Sistema anti-trampa robusto:
  - Detecta cambio de ventana/pestana
  - Detecta conexion a internet
  - Detecta DevTools
  - Detecta inactividad
  - Limite de desbloqueos
- Evaluacion automatica con sistema flexible:
  - 400+ grupos de sinonimos (Lenguaje y Literatura)
  - Stemming basico espanol
  - Tolerancia a errores tipograficos
- Auto-guardado cada 30 segundos
- Respaldo de emergencia de respuestas
- Aleatorizacion de preguntas por alumno

## Instalacion

1. Descarga todos los archivos
2. Abre `examendocente-1.html` en un navegador para crear examenes
3. Abre `examenalumno.html` para aplicar examenes (se puede instalar como PWA)

## Uso

### Crear un examen
1. Abre el Panel Docente
2. Llena los datos del examen
3. Carga un documento con preguntas o agregalas manualmente
4. Revisa y edita las preguntas
5. Define la contrasena de desbloqueo
6. Exporta el JSON

### Aplicar un examen
1. Distribuye el archivo `examenalumno.html` y el JSON del examen
2. El alumno carga el JSON
3. Ingresa su nombre e inicia
4. Al terminar, se evalua automaticamente
5. Puede descargar sus resultados

## Seguridad

- Las respuestas correctas estan codificadas en el JSON
- Contrasena de desbloqueo con hash SHA-256
- Registro de todos los incidentes de seguridad
- Suspension automatica por comportamiento sospechoso

## Tecnologias

- HTML5 + CSS3 + JavaScript vanilla
- PWA con Service Worker
- PDF.js para lectura de PDFs
- Mammoth.js para lectura de Word

## Licencia

Uso educativo - Centro Escolar INSA, Santa Ana, El Salvador
