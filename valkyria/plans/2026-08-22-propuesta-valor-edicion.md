# Plan — Propuesta de valor: edición interna, 4 variables, sin síntesis, personalidad a Estrategia

Pedido del usuario (2026-08-22): (1) herramienta de edición interna del entregable dentro de
la plataforma, pensada para exportar después a una plantilla de PowerPoint — la plantilla
llega más adelante, **no** entra en este plan; (2) cuatro variables de comparación; (3) se
elimina la síntesis del final; (4) la personalidad se muda de Propuesta de valor a Estrategia.

## Contexto (cómo está hoy)

- El entregable son 5 partes generadas por LLM y guardadas como JSON (`deliverables.content`):
  `personalidad` (insumo interno, no se imprime), `problema`, `competencia`, `perfil`,
  `propuestaValor`. Pipeline: `generator.ts` con dependencias (personalidad alimenta a
  problema y perfil).
- Se muestra vía `view-model.ts` → `DeliverableDocument` (HTML) y `DeckDocument` (PDF).
  Solo lectura: el único remedio ante un texto malo es regenerar la parte.
- Las "variables de comparación" son los `ejes` de `competencia`: hoy EXACTAMENTE 2.
- La "síntesis" es el bloque final de la sección 3, armado con `propuestaValor.formula`
  (única consumidora de `formula`).
- La personalidad generada se muestra colapsada en la pantalla Propuesta como "insumo
  interno". Estrategia ya tiene una etapa `personalidad` (contenido jsonb libre, render
  genérico vía `ContenidoEtapa`).

## Tareas

### 1. Cuatro variables de comparación
`steps/competencia.ts`: el prompt pide EXACTAMENTE 4 ejes y `validateCompetencia` lo exige
(el `callJson` reintenta una vez ante validación fallida). Tests ajustados.

### 2. Eliminar la síntesis
- `schema.ts`: `PropuestaValor` pierde `formula` (queda `{ filas }`). Los entregables ya
  guardados con `formula` la conservan en el JSON; simplemente nadie la lee.
- `steps/propuesta-valor.ts`: prompt y validador sin fórmula.
- `view-model.ts`: la sección 3 pierde el bloque Síntesis. El error de `propuestaValor`
  ausente ya viaja por `tablaError`, así que no se pierde señal.

### 3. Personalidad a Estrategia
- Se sigue **generando** (es dependencia de problema y perfil), pero su salida deja de
  vivir en la pantalla Propuesta: al generarse, se guarda como **borrador de Claude en la
  etapa `personalidad` de Estrategia** (`saveStrategyVersion`, author claude, label
  "Generada de las entrevistas"), solo si difiere de la última versión guardada — para no
  ensuciar el historial en cada regeneración idéntica. Con eso entra sola al flujo de
  decisión existente (borrador → aprobar, y la mesa la muestra en "Nos toca").
- `DeliverablePanel` pierde el bloque colapsable "Personalidad (insumo interno)".

### 4. Herramienta de edición interna
- `PartMeta` gana `editedAt`.
- `PATCH /api/projects/[id]/deliverable` con `{part, data}`: valida `data` con el mismo
  validador del paso (problema/competencia/perfil/propuestaValor; personalidad se edita en
  Estrategia, no acá), exige la cookie de admin (helper compartido en `lib/admin/auth`),
  y guarda preservando `generatedAt`.
- UI: cada sección del documento gana "Editar" junto a los botones de regenerar. La sección
  se voltea a formulario (campos de texto, listas de ítems con agregar/quitar, los 4 ejes,
  las filas del canvas) con Guardar/Cancelar. Ítems nuevos nacen con origen `equipo`; el
  origen y las citas de los existentes se preservan; las citas no se editan (son citas
  textuales de las entrevistas).
- Regenerar una parte editada pisa la edición: el botón avisa con `confirm()` cuando la
  parte tiene `editedAt`.
- La exportación a PowerPoint queda para cuando llegue la plantilla; este plan deja el
  contenido editable, que es su insumo.

## Fuera de alcance

Plantilla PPT y su exportación; editar la personalidad desde Propuesta (vive en
Estrategia); editar citas u orígenes de ítems existentes.

## Riesgos

- El modelo puede resistirse a devolver exactamente 4 ejes → el validador estricto +
  reintento de `callJson` lo contienen; si falla dos veces, el error queda visible en la
  parte, como hoy.
- Ediciones perdidas por regeneración → mitigado con la confirmación explícita.
