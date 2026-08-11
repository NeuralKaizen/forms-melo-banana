# Navegación del proyecto y de las etapas de estrategia · Diseño UX

Fecha: 2026-08-11
Origen: feedback del usuario sobre la rama `fase3-pipeline-estrategia` antes del merge — "está rara la
navegación entre etapas de un proyecto y más aún la navegación dentro de las etapas".
Complementa (no reemplaza) el spec funcional `2026-08-11-fase3-pipeline-estrategia-design.md`.

## Los problemas confirmados

1. "Estrategia" quedó como botón suelto al lado de la barra de fases — se lee como apéndice y no
   como la fase que sigue al landscape.
2. Las flechas anterior/siguiente de la cabecera no conocen a Estrategia.
3. La barra mezcla pesos: tres pantallas de la fase 1, el landscape entero, y una "Entrega" que es
   un cascarón sin datos (quedó de cuando el landscape era la última fase; no produce ni consume
   contexto).
4. Las 14 etapas van planas en un carril de 176px con texto de 10px — se perdió la estructura del
   proceso (diagnóstico y consumidor → esencia → cuadros).
5. No hay siguiente/anterior entre etapas dentro del contenido.

Decisiones tomadas con el usuario en la sesión visual: cabecera por grupos (variante B),
carril agrupado **desplegable** con siguiente/anterior (variante A + desplegable), fuera Entrega,
y el grupo 1 se llama **"Entrevistas / Propuesta de valor"**.

## 1. Cabecera del proyecto (todas las pantallas)

Reemplaza la barra de 5 celdas + flechas + botón suelto por **tres grupos**:

| Grupo | Contenido | Avance mostrado |
|---|---|---|
| Entrevistas / Propuesta de valor | pantallas Entrevistas · Propuesta · Taller | estado derivado de las tres (completa cuando el taller está hecho) |
| Landscape | pantalla del landscape | "n de 6 aprobadas" |
| Estrategia | pantalla de estrategia | "n de 14 aprobadas" |

- El grupo activo va resaltado con el lenguaje visual existente (fondo `#fffdf0`, acento banana).
- Clic en un grupo navega a su pantalla principal (grupo 1 → Entrevistas; los otros a su única
  pantalla).
- Cuando el grupo 1 está activo, sus tres pantallas aparecen como **tabs finas** debajo del grupo
  (Entrevistas · Propuesta · Taller). Landscape y Estrategia no tienen segundo nivel.
- Las flechas ‹ › y `neighbours` desaparecen de la cabecera.
- El aviso de `dependencia` (la nota ámbar contextual) se conserva tal cual debajo de los grupos.

**Entrega se elimina**: la ruta `/admin/projects/[id]/entrega`, su celda, su entrada en
`derivePhases`/`PhaseKey` y sus usos. Lo entregado vive en Dropbox; si algún día vuelve, vuelve
como parte del catálogo del archivo, no como pantalla vacía.

`derivePhases` se rehace al modelo de grupos (las señales existentes ya alcanzan: sesiones,
entregable, resumen del landscape — se suma el resumen de estrategia que las páginas ya
calculan). Ninguna pantalla queda sin cabecera durante el cambio: es un reemplazo de
`ProjectHeader` con la misma prop `name` y un modelo nuevo de grupos.

## 2. Workspace de estrategia

- **Carril agrupado desplegable** (reemplaza las 14 filas planas):
  - Tres grupos: "Diagnóstico y consumidor" (`diagnostico`, `consumidor`), "Esencia de marca"
    (las 11 de `ESENCIA`), "Cierre" (`cuadros`).
  - La cabecera de cada grupo muestra nombre + "n de m" (contando `no_aplica` fuera, como
    `summarizeStrategy`) y colapsa/expande al clic.
  - Por defecto: expandido solo el grupo de la etapa activa; el resto plegado.
  - Al seleccionar una etapa de otro grupo (por el pie siguiente/anterior), ese grupo se expande y
    el anterior se pliega.
  - **Sin animación de despliegue** (el usuario es sensible al movimiento): mostrar/ocultar seco;
    a lo sumo la transición de color que ya usan las filas.
- **Carril más ancho** (~240px) con tipografía legible (fila 14px, sub 11.5px). El espacio sale de
  **eliminar la columna derecha**: la nota "Conectado a Claude" pasa a una línea discreta al pie
  del carril (un punto verde y una frase, sin tarjeta).
- **Contenido de la etapa**:
  - Sobre el título, contexto de posición: "Esencia de marca · etapa 4 de 14".
  - Al pie, navegación **"‹ [etapa anterior] · [etapa siguiente] ›"** siguiendo `ETAPA_ORDER`
    (en los extremos, el lado que no existe no se muestra).
  - El aviso de borrador nuevo y la barra de aprobar quedan exactamente como están.
- La grilla pasa de 3 columnas (`176px/1fr/248px`) a 2 (`~240px/1fr`).

## 3. Alcance

- El workspace del landscape **no se toca** — solo hereda la cabecera nueva.
- Copy nuevo en español neutro (tuteo: "elige", "mira"), consistente con el resto del panel.
- Cero movimiento nuevo: nada de slides, springs ni auto-scroll animado.

## 4. Testing

- Header: los tests/pantallas que montan `ProjectHeader` se adaptan al modelo de grupos; se
  verifica que el grupo activo se marque y que las tabs del grupo 1 aparezcan solo ahí.
- Workspace: grupos renderizan con sus contadores; el grupo de la etapa activa arranca expandido y
  los otros plegados; expandir/plegar al clic; siguiente/anterior navega en `ETAPA_ORDER` y cruza
  grupos expandiendo el destino; los tests existentes de aprobar y del aviso siguen verdes.
- Entrega: la ruta y sus referencias desaparecen; `npm run build` no la lista más.

## Criterio de cierre

El usuario recorre Cafe Lunar en el dev server y la navegación entre fases y dentro de las 14
etapas se siente natural: sabe dónde está, cuánto falta por grupo, y avanza de etapa en etapa sin
volver al carril.
