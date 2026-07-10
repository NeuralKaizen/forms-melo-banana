# Rediseño visual del panel admin

**Fecha:** 2026-07-10
**Alcance:** solo visual. Mismas 4 pantallas, mismas funciones, mismas rutas y APIs. El admin hereda el lenguaje visual de la parte pública ("Blanco Apple + crema", Fraunces + subrayado banana, eyebrow dorado) para verse como la trastienda del mismo producto.

## Contexto

El flujo público (portada, entrevista) tiene una identidad definida: fondo `#ece4d2` con card crema `#fffdf2`, LogoBlock amarillo, títulos Fraunces con subrayado banana (`.underline-banana`), eyebrow uppercase dorado (`#b08a1e`), botones ink (`#1a1510`). El admin quedó utilitario: sin marca, `alert()` para errores, badges Tailwind genéricos, listas planas.

## Decisión de enfoque

**Herencia directa** del lenguaje público, más una barra superior mínima que dé sensación de lugar. Se descartaron un look "workspace tipo Linear" (segundo lenguaje visual que mantener) y un look "documento editorial" (incómodo para operar botones y selects).

## Componentes y pantallas

### 1. `AdminBar` (componente nuevo, `src/components/AdminBar.tsx`)

Barra delgada sobre el fondo crema, usada por las 3 páginas autenticadas (`/admin`, `/admin/projects/[id]`, `/admin/[sessionId]`), importada en cada página (no via layout, para que el login no la herede). Contenido: wordmark serif "Mellow & Banana" (link a `/admin`, navegación ya existente de facto) + pill "Panel interno" en estilo eyebrow dorado. No sticky, sin sombra, sin motion.

### 2. Login (`/admin/login`)

Espejo mini de `IdentityForm`:

- Fondo `#ece4d2`, card crema centrada `rounded-[2rem]` con sombra (en móvil, card a pantalla completa como la portada).
- `LogoBlock`, eyebrow "Panel interno", título Fraunces con subrayado banana en la palabra clave (p. ej. "Hola de <u>nuevo</u>").
- Input de contraseña con focus ring banana (mismas clases que los inputs públicos).
- Botón ink primario con estado de carga ("Entrando…", disabled).
- Error inline con `animate-fade` ("Contraseña incorrecta, intenta de nuevo") — se elimina el `alert()`.

### 3. Lista de proyectos (`/admin`)

- `AdminBar` arriba; eyebrow "Panel interno" + título Fraunces "Proyectos" con subrayado banana.
- Cada proyecto: card blanca `rounded-2xl`, borde `black/5`, sombra suave, nombre + chevron a la derecha. Hover: borde banana sutil (transición de color, cero movimiento).
- Estado vacío: mensaje centrado, tono cálido, mismo copy actual.

### 4. Vista de proyecto (`/admin/projects/[id]` + `DeliverablePanel`)

- Header: eyebrow "Proyecto" + nombre en Fraunces.
- Card de respondientes: blanca (hoy crema plana); select "mover a…" estilizado a la paleta; "Descargar PDF del taller" pasa de texto subrayado a botón secundario (borde ink + icono de descarga); "Generar entregable / Regenerar todo" sigue como botón primario ink con estado ocupado.
- Las 5 secciones del entregable: cards blancas consistentes, título de sección con jerarquía clara, "Regenerar" como botón fantasma pequeño.
- Badges de origen, misma semántica con paleta M&B:
  - **cliente** → tinte banana: fondo `#fff3c4`, texto `#8a6d00`
  - **equipo** → tinte ink suave: fondo `#1a1510` al 8%, texto `#1a1510`
  - **pendiente** → gris cálido neutro: fondo `#eeeae0`, texto `#8a8170`
- Fórmula de propuesta de valor: caja crema con borde izquierdo banana grueso.
- Tabla de propuesta de valor: header estilo eyebrow, filas con divisores suaves.
- Errores inline en rojo estilizado (sin emoji ⚠ pelado).

### 5. Detalle de sesión (`/admin/[sessionId]`)

- `AdminBar` + header consistente: eyebrow "Respondiente" + nombre en Fraunces.
- Botón "Descargar PDF" como botón secundario consistente con el del proyecto.
- Respuestas como transcripción cuidada: pregunta en label pequeño gris cálido uppercase, respuesta en cuerpo normal, divisores suaves entre pares.

## Restricciones

- **Motion mínimo:** solo fades (`animate-fade`) y transiciones de color. Nada se traslada ni pulsa. Se respeta `prefers-reduced-motion` (ya cubierto en `globals.css`).
- **Español neutro** en todo copy (tuteo: "intenta", no "intentá").
- **Sin funciones nuevas:** no se agregan links de navegación (el detalle de sesión sigue sin link desde el proyecto — queda para una fase 2), ni métricas, ni gestión de proyectos.
- Sin cambios en rutas, APIs, datos, auth ni lógica de generación.

## Manejo de errores

- Login: error inline en la card.
- DeliverablePanel: el error de generación pasa a un bloque inline estilizado (fondo rojo suave, texto rojo oscuro) en el mismo lugar donde hoy está el `<p>` rojo.
- Páginas "no encontrado" (`Proyecto no encontrado.` / `No encontrado.`): mismo copy, presentado centrado con el estilo del estado vacío.

## Verificación

- Suite Vitest existente en verde.
- `next build` limpio.
- Click-through manual en dev de las 4 pantallas: login (error + éxito), lista, proyecto (generar/regenerar/mover/descargar), detalle de sesión.
