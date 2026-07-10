# Fase 1 — Flujo de trabajo

> **Duración estimada:** ~2 semanas
> **Responsable:** Isa
> **Objetivo:** Procesar entrevistas de cliente → extraer insights con Claude → construir tablero de posicionamiento en Miro → correr taller en vivo → producir deck en Keynote → entregar en PDF por mail.

**Pipeline (6 etapas):**

`01 Recepción` → `02 Extracción` → `03 Miro setup` → `04 Taller` → `05 Producción` → `06 Entrega`

| # | Etapa | Herramienta principal |
|---|-------|-----------------------|
| 01 | Recepción de entrevistas | Mail + Dropbox |
| 02 | Extracción | Claude AI |
| 03 | Setup del tablero | Miro |
| 04 | Taller | Sesión en vivo con cliente |
| 05 | Producción del deck | Keynote |
| 06 | Entrega | PDF + mail |

---

## 01 · Recepción de entrevistas

**Herramientas:** Gmail, Dropbox

### 1.1 Recibe entrevistas por mail
- El cliente envía las entrevistas por correo.
- Isa las descarga.
- **Input:** correo del cliente con archivos de entrevistas.
- **Output:** archivos de entrevistas en local.

### 1.2 Crea carpeta en Dropbox
- Crear una carpeta nueva con el **nombre del proyecto**.
- Dentro, crear la subcarpeta **`00 ENTREVISTAS`**.
- **Output:** estructura `.../[Nombre del proyecto]/00 ENTREVISTAS/` con los archivos ya cargados.

---

## 02 · Extracción con Claude

**Herramientas:** Claude AI

### 2.1 Lee las entrevistas
- Isa lee el material **antes** de pasarlo a Claude, para tener contexto propio.
- **Objetivo:** no delegar a ciegas; entrar al prompt con criterio.

### 2.2 Prompt a Claude — 5 puntos clave
Claude extrae y estructura la información de las entrevistas en estos 5 puntos:

1. **Objetivo general**
2. **Problemática del cliente**
3. **Problema como marca**
4. **Cómo resolverlo**
5. **Por qué es relevante**

- **Input:** texto de las entrevistas.
- **Output:** briefing estructurado en los 5 puntos.

---

## 03 · Setup del tablero Miro

**Herramientas:** Miro (+ Claude como apoyo)

### 3.1 Copia briefing a Miro
- Pegar en los recuadros del tablero la información extraída de las entrevistas (los 5 puntos de la etapa 02).

### 3.2 Tabla de posicionamiento
- Agregar las marcas del cliente **+** otras marcas de la categoría que Isa conozca.
- **Output:** listado de marcas a mapear.

### 3.3 Variables de posicionamiento
- Definir las posibles variables para los **ejes del mapa** de posicionamiento, con ayuda de Claude.
- **Output:** set de variables candidatas para los ejes X/Y.

---

## 04 · Taller con el cliente

**Modalidad:** en vivo, sobre el tablero Miro.

### 4.1 Sesión de taller
- Se trabaja **en vivo** sobre el tablero Miro junto con el cliente.

### 4.2 Rellena el tablero
- Se completan todos los recuadros en **tiempo real** durante el taller.

### 4.3 Post-taller
- Isa llena, con base en lo discutido:
  - **Pains**
  - **Gains**
  - **Jobs to be Done (JTBDs)**

---

## 05 · Producción del deck

**Herramientas:** Keynote

### 5.1 Copia Miro → Keynote
- Pegar las tablas y el mapa de posicionamiento **directo al deck** (literal copy-paste).

### 5.2 Slide — problema
- 1 párrafo con el **contexto de la marca** y el **problema planteado**.

### 5.3 Slide — propuesta de valor
- Estructura *fill in the blanks* + párrafo explicativo + los **JTBDs más relevantes**.

---

## 06 · Entrega al cliente

> ⏱ **Timing:** se ejecuta **2 a 3 días después del taller** — no el mismo día.

### 6.1 Keynote → PDF
- El deck completo se exporta a PDF.
- **Entregable principal.**

### 6.2 Excel cronograma → PDF
- El cronograma del proyecto se convierte a PDF y se adjunta.
- **Adjunto secundario.**

### 6.3 Mail de entrega
- **Remitente:** Isa → Cliente
- **Adjuntos:**
  - `Deck Fase 1.pdf`
  - `Cronograma proyecto.pdf`

---

## Resumen de inputs / outputs por etapa

| Etapa | Input | Output |
|-------|-------|--------|
| 01 Recepción | Mail del cliente con entrevistas | Carpeta Dropbox `[Proyecto]/00 ENTREVISTAS` |
| 02 Extracción | Texto de entrevistas | Briefing en 5 puntos clave |
| 03 Miro setup | Briefing + marcas conocidas | Tablero con briefing, tabla de marcas y variables de ejes |
| 04 Taller | Tablero Miro + cliente en vivo | Tablero completo + Pains / Gains / JTBDs |
| 05 Producción | Contenido del tablero | Deck en Keynote (posicionamiento, problema, propuesta de valor) |
| 06 Entrega | Deck + cronograma | Mail con `Deck Fase 1.pdf` + `Cronograma proyecto.pdf` |
