---
proceso: Landscape
fase: 2
nombre: Investigación
responsable: Isa
studio: Mellow & Banana
entregable: Deck de investigación (Landscape) presentado y enviado al cliente
etapas: [setup, contexto, tendencias, panorama, diagnostico, entrega]
version: 1.0
---

# Fase 2 · Investigación (Landscape)

Flujo operativo de la fase de investigación. Cada tarea está tipificada con
`actor`, `automatizacion`, `inputs`, `outputs` y `criterio_cierre` para que un
agente pueda ejecutarla, delegarla o bloquearla esperando input humano.

## Convenciones

| Campo | Valores | Significado |
|---|---|---|
| `actor` | `agente` · `humano` · `mixto` | Quién ejecuta la tarea |
| `automatizacion` | `alta` · `media` · `baja` | Qué tanto puede resolverse sin intervención |
| `bloqueante` | `true` · `false` | Si detiene el avance de la fase hasta cerrarse |

Variables del proyecto usadas en el flujo:

- `{proyecto}` — nombre del cliente/proyecto
- `{categoria}` — categoría o sector del cliente
- `{tipo_proyecto}` — `marca_nueva` | `rebranding`
- `{pais}` — mercado principal (por defecto: Colombia + global)

---

## Etapa 01 · Setup del proyecto

### 1.1 Crear carpeta en Dropbox
- **id:** `setup.carpeta_dropbox`
- **descripcion:** Crear la carpeta "Fase 01 Landscape" con el nombre del proyecto para alojar todo el material de investigación.
- **actor:** agente
- **automatizacion:** alta
- **inputs:** `{proyecto}`
- **outputs:** ruta de carpeta creada
- **herramientas:** Dropbox API
- **criterio_cierre:** la carpeta existe y es accesible por el equipo
- **bloqueante:** true

### 1.2 Duplicar archivo base
- **id:** `setup.duplicar_template`
- **descripcion:** Partir del layout Landscape estándar de Mellow & Banana como punto de partida del deck.
- **actor:** agente
- **automatizacion:** alta
- **inputs:** template Landscape estándar, ruta de `setup.carpeta_dropbox`
- **outputs:** deck de trabajo `{proyecto} — Landscape.{ext}`
- **tags:** `template`
- **criterio_cierre:** copia del template dentro de la carpeta del proyecto, renombrada
- **bloqueante:** true

---

## Etapa 02 · Contexto del sector

### 2.1 Búsqueda de informes por categoría
- **id:** `contexto.busqueda_informes`
- **descripcion:** Reunir reportes de consultoras y artículos relevantes para la categoría del cliente.
- **actor:** mixto
- **automatizacion:** media
- **inputs:** `{categoria}`, `{pais}`
- **outputs:** set de informes/artículos guardados en la carpeta del proyecto + índice de fuentes
- **tags:** `consultoras`, `artículos`
- **criterio_cierre:** mínimo de fuentes recolectadas y curadas por el responsable
- **bloqueante:** true
- **nota_automatizacion:** el agente puede buscar, descargar y resumir; la curaduría de calidad de fuente queda en humano.

### 2.2 Contexto actual del sector (IA)
- **id:** `contexto.panorama_sector`
- **descripcion:** Definir el panorama del sector con IA a partir de las fuentes recolectadas.
- **actor:** agente
- **automatizacion:** alta
- **inputs:** outputs de `contexto.busqueda_informes`
- **outputs_estructurados:**
  - datos generales global / `{pais}`
  - cifras relevantes (con fuente y año)
  - drivers de cambio
  - evolución del consumidor
  - retos del sector
  - qué buscan los clientes del segmento
- **criterio_cierre:** cada bloque redactado y con fuente trazable
- **bloqueante:** true

---

## Etapa 03 · Tendencias

### 3.1 Tendencias que impactan al sector
- **id:** `tendencias.exploracion`
- **descripcion:** Con base en los informes adjuntos y lo investigado, identificar qué tendencias afectan al sector en marca, estrategia y comunicación.
- **actor:** agente
- **automatizacion:** alta
- **inputs:** `contexto.panorama_sector`, informes adjuntos
- **outputs:** long list de tendencias clasificadas por eje (marca / estrategia / comunicación)
- **bloqueante:** false

### 3.2 Revisar entregas anteriores
- **id:** `tendencias.insumo_interno`
- **descripcion:** Revisar otros proyectos del studio que puedan servir de insumo para la definición de tendencias.
- **actor:** mixto
- **automatizacion:** media
- **inputs:** repositorio de landscapes previos
- **outputs:** fragmentos y tendencias reutilizables, con referencia al proyecto de origen
- **tags:** `insumo interno`
- **criterio_cierre:** revisión hecha sobre proyectos de categoría afín
- **nota_automatizacion:** aquí conecta la base de conocimiento de landscapes previos (búsqueda semántica sobre el contenido de los documentos).

### 3.3 Definir 4–5 tendencias principales
- **id:** `tendencias.seleccion`
- **descripcion:** Consolidar la long list en 4–5 tendencias principales. Cada una se desarrolla en 3 diapositivas.
- **actor:** mixto
- **automatizacion:** media
- **inputs:** `tendencias.exploracion`, `tendencias.insumo_interno`
- **estructura_por_tendencia:**
  1. Explicación general
  2. Profundización
  3. Enfoques que puede desarrollar la marca
- **outputs:** 12–15 slides (3 por tendencia)
- **criterio_cierre:** entre 4 y 5 tendencias aprobadas por el responsable
- **bloqueante:** true
- **nota_automatizacion:** el agente propone y redacta; la selección final es decisión humana.

### 3.4 Búsqueda de casos por tendencia
- **id:** `tendencias.casos`
- **descripcion:** Buscar casos de referencia por tendencia, apoyándose en IA y listados (ej. "10 mejores marcas de...").
- **actor:** agente
- **automatizacion:** alta
- **inputs:** `tendencias.seleccion`
- **outputs:** por tendencia — casos con marca, mercado, descripción breve, link e imagen
- **criterio_cierre:** cada tendencia con al menos N casos (definir N)
- **bloqueante:** false

---

## Etapa 04 · Panorama de categoría

### 4.1 Benchmarking
- **id:** `panorama.benchmarking`
- **descripcion:** Análisis de referentes y competencia sobre 4 ejes.
- **actor:** mixto
- **automatizacion:** media
- **ejes:** logos · páginas web · redes sociales · experiencia de marca
- **inputs:** lista de referentes y competidores
- **outputs:** ficha por marca con los 4 ejes + capturas
- **criterio_cierre:** todas las marcas de la lista cubiertas en los 4 ejes
- **bloqueante:** true

### 4.2 Cuadro de Brand Assets
- **id:** `panorama.brand_assets`
- **descripcion:** Cuadro comparativo de los 4 competidores principales definidos en el Taller de PV.
- **actor:** mixto
- **automatizacion:** media
- **inputs:** output del Taller de PV (4 competidores principales)
- **campos:** territorio · mensajes · claims
- **outputs:** tabla comparativa 4×3
- **tags:** `del taller PV`
- **dependencia_externa:** requiere Taller de PV cerrado
- **bloqueante:** true

### 4.3 Círculo cromático
- **id:** `panorama.circulo_cromatico`
- **descripcion:** Ubicar competidores y referentes en el círculo cromático para identificar espacios de color disponibles.
- **actor:** mixto
- **automatizacion:** media
- **inputs:** logos e identidades de `panorama.benchmarking`
- **outputs:** mapa visual + lectura de espacios de color libres
- **tags:** `mapa visual`
- **nota_automatizacion:** extracción de paleta desde los logos es automatizable; la lectura estratégica del espacio libre es humana.

---

## Etapa 05 · Diagnóstico (condicional)

### 5.1 Análisis de assets actuales
- **id:** `diagnostico.assets_actuales`
- **descripcion:** Analizar los assets vigentes de la marca para introducir la pregunta de si el proyecto busca una evolución o una revolución.
- **condicion:** `{tipo_proyecto} == rebranding`
- **actor:** mixto
- **automatizacion:** media
- **inputs:** assets vigentes de la marca
- **outputs:** diagnóstico de assets + planteamiento evolución vs. revolución
- **tags:** `solo rebranding`
- **bloqueante:** solo si aplica la condición

---

## Etapa 06 · Entrega

> Regla del proceso: la presentación con el cliente (presencial u online) ocurre **antes** del envío final del archivo.

### 6.1 Presentación al cliente
- **id:** `entrega.presentacion`
- **descripcion:** Presentar el deck al cliente, presencial u online.
- **actor:** humano
- **automatizacion:** baja
- **inputs:** deck consolidado
- **outputs:** feedback del cliente
- **criterio_cierre:** sesión realizada y feedback registrado
- **bloqueante:** true

### 6.2 Envío de archivo
- **id:** `entrega.envio`
- **descripcion:** Enviar el deck final al cliente.
- **actor:** agente
- **automatizacion:** alta
- **precondicion:** `entrega.presentacion` cerrada
- **inputs:** deck final (con ajustes post-presentación)
- **outputs:** archivo enviado + registro de envío
- **criterio_cierre:** confirmación de envío

---

## Grafo de dependencias

```
setup.carpeta_dropbox ──► setup.duplicar_template
                                │
                                ▼
                    contexto.busqueda_informes ──► contexto.panorama_sector
                                                          │
                        ┌─────────────────────────────────┤
                        ▼                                 ▼
             tendencias.exploracion            panorama.benchmarking ──► panorama.circulo_cromatico
             tendencias.insumo_interno         panorama.brand_assets  (requiere Taller PV)
                        │
                        ▼
             tendencias.seleccion ──► tendencias.casos
                        │
                        ▼
             diagnostico.assets_actuales  (solo si tipo_proyecto == rebranding)
                        │
                        ▼
             entrega.presentacion ──► entrega.envio
```

Las etapas 03 y 04 pueden correr en paralelo.

---

## Estado del proyecto (esquema sugerido)

```json
{
  "proyecto": "",
  "categoria": "",
  "tipo_proyecto": "marca_nueva | rebranding",
  "pais": "Colombia",
  "carpeta_dropbox": "",
  "deck_path": "",
  "tareas": {
    "setup.carpeta_dropbox": { "estado": "pendiente | en_curso | cerrada", "output_ref": "" }
  },
  "fuentes": [],
  "tendencias": [
    { "nombre": "", "eje": "", "casos": [], "slides": [] }
  ],
  "competidores": []
}
```

---

## Notas para automatización

1. **Automatizable de punta a punta:** `setup.*` y `entrega.envio`. Son operaciones de archivo con reglas claras de nomenclatura.
2. **Automatizable con revisión humana:** todo `contexto.*`, `tendencias.exploracion`, `tendencias.casos`. El agente produce borrador y el humano aprueba.
3. **Decisión humana obligatoria:** `tendencias.seleccion` (las 4–5 finales), la lectura estratégica del `panorama.circulo_cromatico` y `entrega.presentacion`.
4. **Punto de conexión con la base de conocimiento:** `tendencias.insumo_interno` es donde el agente debe consultar landscapes previos. Es la tarea con más valor por reutilización.
5. **Dependencias externas al flujo:** `panorama.brand_assets` depende del Taller de PV, que ocurre fuera de esta fase. Conviene marcarlo como input externo con estado propio.
6. **Definiciones pendientes antes de automatizar:**
   - número mínimo de fuentes en `contexto.busqueda_informes`
   - número mínimo de casos por tendencia (`N`)
   - convención exacta de nomenclatura de carpetas y archivos
   - formato del deck (Google Slides, Keynote, Figma) para saber si el agente puede escribir slides directamente o solo generar el contenido
