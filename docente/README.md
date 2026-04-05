# Panel Docente - ExamenApp INSA

Herramienta para crear examenes digitales desde documentos Word o PDF.

## Caracteristicas

- Carga documentos Word (.docx) o PDF
- Detecta automaticamente preguntas y tipos:
  - Opcion multiple
  - Verdadero/Falso
  - Desarrollo
  - Completar espacios
  - Calculo/Ejercicios
  - Relacionar
  - Ordenar
- 6 estrategias de parsing para diferentes formatos
- Editor visual de preguntas
- Genera palabras clave automaticamente
- Exporta JSON protegido con contrasena
- Genera formato imprimible (HTML)

## Uso

1. Abre `examendocente-1.html` en cualquier navegador
2. Llena los datos del examen (nombre, materia, grado)
3. Carga tu documento con preguntas o agregalas manualmente
4. Revisa y edita cada pregunta
5. Define la contrasena de desbloqueo
6. Exporta:
   - **JSON** para usar con la app del alumno
   - **HTML** para imprimir en papel

## Formatos de preguntas soportados

```
1. Pregunta numerada con punto
1) Pregunta numerada con parentesis
Pregunta 1: Formato con etiqueta

a) Opcion A
b) Opcion B
c) Opcion C

Verdadero o Falso: El cielo es azul
Completa: El autor de Don Quijote es ___
```

## App del Alumno

Usa junto con: [examenapp-insa](https://github.com/agenciaposted-maker/examenapp-insa)

---
Centro Escolar INSA - Santa Ana, El Salvador
