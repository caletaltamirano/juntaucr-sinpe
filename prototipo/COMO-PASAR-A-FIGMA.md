# Prototipo JUNTAUCR SINPE → Figma

`index.html` tiene 21 pantallas (1440 px de ancho) con datos ficticios.

## Modos de vista
| URL | Qué muestra |
|---|---|
| `index.html` | **Lienzo**: todas las pantallas, una debajo de otra |
| `index.html?modo=demo` | **Prototipo navegable**: una pantalla a la vez y los botones navegan |
| `index.html?pantalla=sinpe` | Una sola pantalla (para importar pantalla por pantalla) |

IDs de pantalla: `login`, `dashboard`, `clientes`, `cliente-nuevo`, `cliente-detalle`, `cuentas`, `cuenta-nueva`,
`cuenta-detalle`, `telefonos`, `telefono-nuevo`, `sinpe`, `sinpe-trasladar`, `sinpe-desafiliar`, `sinpe-historial`,
`transferir-tel`, `transferir-iban`, `transferir-confirmar`, `transferir-exito`, `transferir-error`, `movimientos`, `catalogos`.

## Importar a Figma (html.to.design)
1. En Chrome, instalar la extensión **html.to.design**. En `chrome://extensions` → Detalles → activar
   **"Permitir acceso a URL de archivo"**.
2. En Figma, instalar el plugin **html.to.design**.
3. Abrir `index.html` en Chrome (lienzo). Ventana de al menos 1520 px de ancho.
4. Con la extensión, capturar la página → descarga un archivo `.h2d`.
5. En Figma: Plugins → html.to.design → pestaña de importar archivo → cargar el `.h2d`.
6. Cada pantalla queda como un bloque de 1440 px. Seleccionar cada uno → clic derecho → **Frame selection**
   (Ctrl+Alt+G) y renombrarlo como su etiqueta.

> El plan gratuito del plugin tiene un límite de importaciones; por eso conviene importar el lienzo completo de una vez.
> Si se prefiere un frame por pantalla, usar `?pantalla=<id>` con la ventana a 1440 px.

## Hacerlo clicable en Figma (pestaña Prototype)
Conexiones mínimas (On click → Navigate to):
- Login "Ingresar" → Inicio
- Menú lateral → cada sección
- Clientes: fila → Detalle; "Nuevo cliente" → panel lateral (Open overlay)
- Cuentas: fila → Detalle; "Nueva cuenta" → Nueva cuenta
- Teléfonos: "Registrar teléfono" → panel lateral; "Afiliar" → SINPE Móvil
- SINPE: "Trasladar" / "Desafiliar" → modales; "Historial" → Historial
- Transferir: pestañas teléfono/IBAN; "Revisar transferencia" → Confirmar → Enviada ("Probar un rechazo" → Rechazada)
