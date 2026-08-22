# Propuesta — Navegación de proyectos en el panel interno (handoff)

Las **tres opciones de layout** para moverse adentro de un proyecto, listas para mostrar.
Nada de esto compromete cambios nuevos: es material de propuesta, y el follow-up se hace
en otra sesión cuando el estudio (o nosotros) decida.

## Qué hay acá

- **`propuesta-navegacion.html`** — la página de presentación, autocontenida: se abre con
  doble clic en cualquier navegador, sin servidor. Tiene las tres opciones con maquetas
  en miniatura del panel (B y C son interactivas: pestañas, chips y tarjetas responden al
  clic), una tabla comparativa y nuestra lectura al final.
- La misma página está publicada como artifact (privado hasta compartirlo desde el menú
  de la propia página): <https://claude.ai/code/artifact/65c504b9-2aaf-4ff9-bcba-a515e53256c4>

## Las tres opciones, en una línea

| | Opción | Idea |
|---|---|---|
| A | **El índice lateral** | Todo el mapa de etapas siempre visible en una columna junto al documento. |
| B | **Fases como subsecciones** | Las tres fases como pestañas junto al nombre del proyecto; las etapas de la fase abierta como chips; el documento a todo lo ancho. |
| C | **La mesa de trabajo** | El proyecto abre con el trabajo (qué te toca, qué cambió) y la estructura queda plegada en tres tarjetas de fase. |

## Estado real del código hoy (para no confundirse al presentar)

- **C ya está implementada como portada del proyecto** (`/admin/projects/[id]` es la mesa
  de trabajo desde el 2026-08-21/22).
- **A sigue viva en las pantallas de etapa** (entrevistas, landscape, estrategia,
  propuesta, taller conservan el índice lateral).
- **B no está implementada.**
- Es decir: hoy conviven C (portada) + A (etapas). La decisión pendiente es **el chrome de
  las pantallas de etapa**: dejar A como está, aligerarla, o adoptar B ahí.

## Follow-up (próxima sesión)

1. Mostrar la página al estudio (o usarla de base para la propuesta formal).
2. Recoger la decisión sobre el chrome de etapas (A / A aligerada / B).
3. Implementar lo decidido; si es B, el límite conocido son los 4 bloques × 14 etapas de
   Estrategia (piden segunda fila de chips o desplegable por bloque).
4. Registrar la decisión en `valkyria/DECISIONES.md`.
