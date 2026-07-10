# PDF del entregable pre-taller + envío por correo — Diseño

**Fecha:** 2026-07-10
**Estado:** aprobado, listo para plan de implementación

## Problema

El motor de generación (`src/lib/deliverable/`) produce un `Deliverable`: un JSON con cinco partes. Ese JSON no es un entregable. Hoy sólo se ve como datos en el panel de admin, y nadie fuera del equipo técnico puede leerlo.

Isa (estrategia) necesita llegar al Taller de Propuesta de Valor con un documento en la mano. Hoy lo arma a mano: lee las entrevistas, se las pasa a Claude, copia el resultado a Miro (etapas 01→03 de `docs/Fase1_Flujo_de_trabajo.md`).

Este diseño automatiza esas tres etapas: cuando el entregable se genera, sale un PDF legible y le llega por correo.

## Alcance

**Esto es el insumo PRE-taller, no el deck final al cliente.**

El deck final se produce dos o tres días *después* del taller, con lo que se decidió en la sesión en vivo. La app no estuvo ahí y no puede generarlo. Confundir ambos artefactos rompe la regla de oro del skill (`docs/analisis-entrevista-proyectiva/SKILL.md`): no inventar lo que el cliente no dijo.

Por lo tanto:

- **Destinatario: el equipo (Isa), nunca el cliente.** El envío al cliente, si algún día existe, lo dispara un humano.
- **Sin gráficos.** No se dibuja el mapa de posicionamiento ni se maqueta el Value Proposition Canvas. El contenido de la Parte 2 (ejes, posiciones) va como texto. Decisión explícita del usuario: "no es necesario emular gráficos, sólo las respuestas en un formato lindo y entendible".
- **Sin `.pptx`.** El formato es PDF, reusando `@react-pdf/renderer`, que ya está en el stack y ya corre en producción (`/api/sessions/[id]/pdf`).

### Fuera de alcance

Tablero de Miro por API. Deck post-taller. Exportación a PowerPoint. Cerrar los agujeros de seguridad de las rutas de API (registrado aparte; ver "Riesgos").

## Arquitectura

Tres unidades nuevas, con fronteras estrictas.

### 1. `src/lib/deck/view-model.ts` — constructor de vista (función pura)

`buildDeckView(deliverable: Deliverable, project: {name}, respondents: RespondentInput[]): DeckView`

Toda la lógica de contenido vive acá. No sabe nada de PDF ni de correo. Se testea con objetos planos.

Responsabilidades:
- Ordenar las tres partes y sus bloques.
- Resolver qué se hace con partes en error o vacías.
- **Verificar cada cita** contra las respuestas originales (ver "Verificación de citas").
- Traducir `origen` a una etiqueta visible.
- Decidir si el entregable está completo (habilita el envío) o no.

`DeckView` es una estructura de secciones y bloques, sin nada específico del renderizador.

### 2. `src/lib/deck/DeckDocument.tsx` — renderizador

Componente de `@react-pdf/renderer` que toma un `DeckView` y lo dibuja. Gemelo de `src/lib/pdf/BriefDocument.tsx`; sigue el mismo patrón.

### 3. `src/lib/mailer/` — envío

```ts
export interface Mailer {
  send(msg: { to: string; subject: string; text: string; attachment: { filename: string; content: Buffer } }): Promise<void>
}
```

Dos implementaciones:
- `SmtpMailer` — `nodemailer` sobre Gmail SMTP. Se usa cuando hay credenciales.
- `FileMailer` — escribe el mensaje y el adjunto a disco (`/tmp`, el único directorio escribible en Vercel; en local, `tmp/mail/`) y loguea la ruta. Se usa cuando faltan credenciales, y en tests.

La selección ocurre en un único punto (`getMailer()`), según haya o no `GMAIL_APP_PASSWORD`.

## Contenido del PDF

Sigue la anatomía del deck de LAB10 (`references/estructura-y-ejemplo.md`), en versión documento.

1. **Portada** — "Taller de Propuesta de Valor", nombre de la marca, fecha.
2. **Divisor Parte 1** — campo amarillo pleno (`#ffd400`), número de parte grande y translúcido al fondo, título en negro. *(Elegido por el usuario sobre las alternativas tipográfica y con hueco para foto; M&B no tiene fotografía en el repo y stock/IA está descartado.)*
3. **Parte 1 — Declaración del problema.** Los cinco bloques: problema del mundo, problema de la marca, problema del consumidor, cómo lo hacemos, por qué es relevante.
4. **Divisor Parte 2.**
5. **Parte 2 — Panorama de la categoría.** Competidores (lista), otros referentes con su etiqueta, los dos ejes propuestos, posición actual y posición ideal descritas en texto.
6. **Divisor Parte 3.**
7. **Parte 3 — Perfil de usuario y Propuesta de Valor.** Jobs, gains, pains. La fórmula de síntesis. La tabla JTBD → solución → cómo se resuelve.
8. **Cierre** — contacto.

**`personalidad` no tiene sección.** Es el paso 0 del motor, insumo de los demás pasos, no parte del entregable del taller.

### Marcado de origen (transversal)

Cada ítem lleva su `origen` visible:

| `origen` | Cómo se ve |
|---|---|
| `cliente` | Texto normal, con la cita textual debajo si existe |
| `equipo` | Etiqueta "propuesta del equipo" |
| `pendiente` | Etiqueta "pendiente del taller", en gris |

Los pendientes **se imprimen**, no se ocultan: son la agenda de la sesión.

Las tensiones entre respondientes que el modelo haya detectado se muestran donde aparezcan, sin promediarse.

### Verificación de citas

El skill prohíbe inventar citas: "verbatim o no se cita".

`buildDeckView` normaliza (minúsculas, espacios colapsados, sin tildes) cada `Item.cita` y busca esa cadena como subcadena del texto normalizado de alguna respuesta del proyecto (`rawText` o `normalizedText`). **Si no aparece, la cita se descarta** y el ítem se imprime sin comillas. El texto del ítem se conserva.

Esto es una verificación de código, no una promesa del prompt. Es la salvaguarda central del diseño.

## Envío

**Disparador:** al completarse con éxito una generación **completa** (`POST /api/projects/[id]/deliverable` sin `?part=`).

**No se envía** al regenerar una sola parte. Un botón "Reenviar" en el panel permite el envío manual en cualquier momento.

**Si alguna parte falló** (`part.data === null`), **no se envía nada**. El panel muestra qué parte falló. Un PDF con secciones vacías obliga a auditarlo antes de confiar en él; peor que no recibirlo. Los ítems marcados `pendiente` no son fallos: van en el PDF.

**El correo no puede romper la generación.** El envío ocurre *después* de persistir el entregable. Si el SMTP falla, se registra el error, el entregable queda guardado y descargable, y "Reenviar" reintenta. La generación cuesta dinero y no se descarta por un fallo de correo.

**Remitente:** `admin@joinaceleratalent.com`, vía Gmail SMTP con contraseña de aplicación.
**Destinatario:** `isabel@mmbanana.co` (confirmado por el usuario, copiado de Gmail; nótese que `references/estructura-y-ejemplo.md` cita `carlos@mbanana.co`, con una sola eme — alguno de los dos documentos está desactualizado, pero no afecta al envío).

Se usa SMTP en vez de Resend porque no requiere verificar un dominio en el DNS: escribir *desde* un dominio propio exige esa verificación; escribirle *a* Isa, no. El día que M&B verifique su dominio, se escribe una implementación nueva de `Mailer` y no se toca nada más.

**Runtime:** la ruta debe declarar `export const runtime = 'nodejs'` (SMTP no funciona en Edge). La ruta del PDF ya lo hace.

### Variables de entorno

| Variable | Uso |
|---|---|
| `GMAIL_USER` | `admin@joinaceleratalent.com` |
| `GMAIL_APP_PASSWORD` | Contraseña de aplicación de 16 caracteres |
| `DELIVERABLE_RECIPIENT` | `isabel@mmbanana.co` |

Si `GMAIL_APP_PASSWORD` está vacía, `getMailer()` devuelve `FileMailer` y el sistema funciona igual, escribiendo el correo a disco. Esto permite construir, probar y demostrar todo sin credenciales.

## Errores y bordes

| Caso | Comportamiento |
|---|---|
| Proyecto sin sesiones completadas | No genera. El panel lo dice. |
| Un solo respondiente | Genera normal. El preámbulo ya prohíbe forzar tensiones inexistentes. |
| Una parte en error | No se envía correo. El panel muestra el error por parte. |
| Ítem sin cita | Se imprime sin comillas. |
| Cita que no aparece textual | Se descarta la cita, se conserva el texto. |
| Lista vacía (p. ej. sin competidores) | Se imprime "pendiente del taller", no una sección en blanco. |
| SMTP caído | Entregable persiste. Error registrado. "Reenviar" disponible. |
| Sin credenciales de Gmail | `FileMailer`. Nada se rompe. |

## Testing

**`view-model.ts`** — el grueso de las pruebas, con objetos planos: parte en error, ítems vacíos, cita inventada (se descarta), cita real (sobrevive), cita con tildes y mayúsculas distintas (sobrevive), un solo respondiente, listas vacías, entregable completo vs incompleto.

**`DeckDocument.tsx`** — se renderiza a buffer en memoria y se verifica que no explota y que aparecen los textos clave. Hay precedente: `src/lib/pdf/preview.test.tsx`.

**`mailer`** — contra `FileMailer`: destinatario, asunto, nombre y presencia del adjunto. Ninguna prueba toca la red.

**Verificación final (manual, no automatizable):** con crédito cargado en OpenRouter, generar el entregable de un proyecto real, abrir el PDF y leerlo. Que compile no significa que se entienda.

## Riesgos

1. **Crédito de OpenRouter en negativo.** Hasta que se recargue, el entregable no se genera y esta feature no se puede verificar de punta a punta. Bloqueante para la verificación final, no para la implementación.
2. **Contraseña de aplicación de Gmail.** Requiere verificación en dos pasos activa en `admin@joinaceleratalent.com`. Si la cuenta la administra otra persona, hay que pedirla. Mitigado por `FileMailer`.
3. **Rutas de API abiertas.** `POST /api/projects/[id]/deliverable` no valida autenticación. Esta feature le agrega un efecto secundario (mandar un correo), lo que convierte un endpoint abierto en un endpoint abierto que además envía correos. Registrado en la memoria del proyecto. **Debería cerrarse antes o junto con esta feature.**
