# AGENTS.md · Contexto del proyecto JUNTAUCR SINPE

Este archivo es para cualquier persona o agente de IA (Claude Code, Codex, Cursor…) que retome el proyecto.
Léalo completo antes de cambiar algo.

## 1. Qué es

Proyecto universitario en grupo (3 o 4 integrantes) para **recuperar nota**, con valor de 10 %.
El profesor pidió llevar el ejercicio de la prueba corta "SINPE JUNTAUCR" a una aplicación (web, móvil o escritorio).
Elegimos **web**. Lo que se entregue como prototipo se toma como resultado final de la aplicación.

- **Entrega:** 9 de noviembre de 2026.
- **Enunciado:** la entidad ficticia JUNTAUCR simula clientes, entidades financieras, cuentas IBAN, teléfonos,
  afiliaciones a SINPE Móvil y transferencias (por teléfono o por IBAN) con historial verificable. No se conecta
  con el Banco Central de Costa Rica. El PDF del enunciado no se sube al repositorio; abajo está el resumen.

### Resumen del enunciado

**Reglas de negocio obligatorias**

1. Un cliente puede tener varias cuentas IBAN y varios teléfonos.
2. Cada teléfono tiene un solo titular, es único y tiene exactamente 8 dígitos.
3. Registrar un teléfono **no** lo afilia a SINPE Móvil.
4. Una cuenta puede tener varios teléfonos afiliados, siempre que todos sean del titular de la cuenta.
5. Cada teléfono tiene como máximo una afiliación vigente, aunque puede cambiar de cuenta con el tiempo.
6. Solo se afilian cuentas **ACTIVAS en CRC**.
7. No se transfiere entre teléfonos afiliados a la misma cuenta, ni de un IBAN a sí mismo.
   Ejemplos: 88881111 → 88882222 (ambos en IBAN 001) se rechaza; IBAN 001 → IBAN 002 se permite.
8. Toda transferencia exige cuentas activas, monto positivo y saldo suficiente. Por IBAN, además, la misma moneda.
9. Cada operación confirmada deja evidencia histórica. Si hay un error, se revierte toda la transacción.
10. No se puede cambiar la titularidad de forma que deje afiliaciones vigentes inválidas: se rechaza o se gestiona
    con un procedimiento controlado.

**Procedimientos obligatorios:** `sp_registrar_cuenta`, `sp_registrar_telefono`, `sp_afiliar_sinpe`,
`sp_desafiliar_sinpe`, `sp_cambiar_cuenta_sinpe`, `sp_transferir_sinpe`, `sp_transferir_iban`, `sp_consultar_movimientos`.
Deben usar `START TRANSACTION`/`COMMIT`/`ROLLBACK`, `EXIT HANDLER FOR SQLEXCEPTION` + `RESIGNAL`,
y `SIGNAL SQLSTATE '45000'` para los errores de negocio.

**Triggers obligatorios** (sin COMMIT ni ROLLBACK):
1. BEFORE INSERT en `afiliacion_sinpe`: valida cuenta activa, moneda CRC y mismo titular.
2. AFTER INSERT en `afiliacion_sinpe`: registra AFILIACION en `historial_afiliacion`.
3. BEFORE DELETE en `afiliacion_sinpe`: registra DESAFILIACION en `historial_afiliacion`.
4. BEFORE INSERT en `transferencia`: rechaza monto no positivo y cuentas iguales. Hay que justificar por qué las
   demás validaciones están en los procedimientos.

**Informes:**
- 5.1 Teléfonos de cada cliente, indicando cuáles están afiliados.
- 5.2 Teléfonos de una cuenta IBAN.
- 5.3 Historial de afiliaciones de un teléfono.
- 5.4 Transferencias enviadas y recibidas por una cuenta.
- 5.5 Totales enviados y recibidos en un período.
- 5.6 Conservación del total en las transferencias internas.

## 2. Estado actual (al 2026-11-05)

| Etapa | Estado | Dónde |
|---|---|---|
| Prototipo navegable (21 pantallas, diseño "Billete de colón") | ✅ Hecho | `prototipo/index.html` (`?modo=demo` para navegarlo) |
| Prototipo importado a Figma (html.to.design) | ✅ Hecho | Archivo de Figma del grupo (fuera del repositorio) |
| Guía PDF de pantallas | ✅ Hecho | `Guia-de-pantallas-JUNTAUCR.pdf` |
| Base de datos MySQL completa | ✅ Hecho, 36/36 pruebas pasan | `app/db/` |
| Servidor web (Node + Express) | ✅ Hecho | `app/server.js` |
| Interfaz web real (todas las pantallas del prototipo) | ✅ Hecha y revisada en Chrome | `app/public/` |

## 3. Cómo correrlo

Requisitos: MySQL 8 y Node 18 o más reciente.

```bash
cd app
npm install
copy .env.example .env        # poner DB_PASSWORD de su MySQL
npm run instalar-bd           # crea juntaucr_sinpe con datos de prueba (borra y recrea)
npm run pruebas-bd            # reinstala y ejecuta 06_pruebas.sql (tabla PASA/FALLA)
npm start                     # http://localhost:3100
```

Ingreso (una sola pantalla, se elige la entidad financiera):
- **Administración:** entidad «Administración JUNTAUCR», `admin@juntaucr.cr` / `juntaucr2026`. Crea clientes (con clave inicial), cuentas IBAN, teléfonos, catálogos y cambia estados. Ve todas las entidades.
- **Cliente:** elige su entidad y entra con su correo y `juntaucr2026`, p. ej. `ana.rodriguez@correo.cr` (JUNTAUCR) o `cjimenez@correo.cr` (Banco Volcán). Solo ve y opera lo suyo dentro de esa entidad: afiliar/desafiliar/trasladar SINPE, registrar teléfono, transferir (a cualquier entidad) y ver movimientos. Si no tiene cuentas en la entidad elegida, no entra.

Detalles del entorno que ya causaron problemas:
- **Use `DB_HOST=127.0.0.1`**, no `localhost`: en Windows el controlador `mysql2` intenta IPv6 y la conexión se queda colgada sin error.
- El puerto es **3100**, porque en la máquina de un integrante el 3000 ya estaba ocupado.
- `.env` tiene contraseñas y **nunca** se sube (está en `.gitignore`).
- `npm run pruebas-bd` deja la base con transferencias de prueba. Para volver a los datos limpios, ejecute `npm run instalar-bd`.

## 4. Arquitectura y reglas para modificar

```
prototipo/          Prototipo estático (fuente del diseño). No se conecta a nada.
app/
  db/01_esquema.sql        Tablas, CHECK, UNIQUE, FK
  db/02_triggers.sql       4 triggers obligatorios + 6 adicionales (regla 10 e inmutabilidad)
  db/03_procedimientos.sql Procedimientos obligatorios + sp_registrar_cliente,
                           sp_cambiar_titular_telefono, sp_cambiar_estado_cuenta
  db/04_consultas.sql      Vistas (v_cuentas, v_transferencias, v_telefonos_cliente) e informes 5.x
  db/05_datos.sql          Escenario de prueba, cargado con los procedimientos
  db/06_pruebas.sql        36 casos (sp_probar ejecuta SQL dinámico y anota PASA/FALLA)
  instalar.js              Ejecuta db/*.sql y entiende DELIMITER, como Workbench
  server.js                API REST: solo llama a procedimientos y vistas
  public/                  SPA sin framework: index.html, app.js, styles.css
```

**Reglas del proyecto (respételas):**
1. **Toda regla de negocio va en MySQL** (procedimientos y triggers), nunca en `server.js` ni en `app.js`.
   El servidor traduce `sqlState 45000` a HTTP 422 y la interfaz muestra el mensaje tal cual. Es lo que se califica.
2. La interfaz puede **adelantar** validaciones (vista previa de la transferencia, contador de dígitos del IBAN),
   pero la decisión final es siempre del procedimiento.
3. Los procedimientos reciben **llaves naturales** (IBAN, número de teléfono, identificación, código de entidad
   o moneda) para que los scripts SQL se lean solos.
4. Los mensajes de error van en español y son útiles para el usuario. `MESSAGE_TEXT` admite como máximo 128 caracteres.
5. **Historial:** el procedimiento fija `@motivo_evento` antes de insertar o borrar en `afiliacion_sinpe` y lo
   limpia después (también en el handler). Los triggers lo copian al historial.
6. **Bloqueos en transferencias:** `FOR SHARE` sobre las afiliaciones y `FOR UPDATE` sobre las dos cuentas,
   siempre del id menor al mayor (`LEAST`/`GREATEST`) para evitar interbloqueos.
7. `sp_cambiar_cuenta_sinpe` valida la cuenta nueva **solo en el trigger del paso 2**, a propósito: así se
   puede demostrar que el `ROLLBACK` recupera la afiliación original. No "arregle" eso validando antes.
8. `historial_afiliacion` y `transferencia` son inmutables (triggers). Para reiniciar datos, reinstale la base.
9. Si agrega un procedimiento u objeto nuevo, agréguelo también a `06_pruebas.sql` y a la tabla del README.
10. Diseño: use los tokens y clases de `styles.css`, que vienen del prototipo. Por ejemplo `.block`, `.figs`,
    `.pair` (el "par SINPE" origen → monto → destino), `.st` (estado con punto) y `.note`.
    No use píldoras, encabezados en mayúscula ni tarjetas con íconos.

11. **Roles:** `usuario.rol` es `ADMIN` o `CLIENTE` (con `id_cliente`). `sp_registrar_cliente` recibe la clave inicial y crea también el usuario. En `server.js`, `soloAdmin`, `exigirCuentaPropia` y `exigirTelefonoPropio` solo limitan QUIÉN pide cada operación; las reglas de negocio siguen en MySQL. La sesión del cliente guarda la entidad elegida. «Por teléfono» elige la cuenta de origen y el teléfono se deduce de sus afiliaciones.
12. **Paleta por entidad:** `styles.css` define `html[data-entidad="0814"|"0901"|"0733"]` (naranja, azul, morado); JUNTAUCR y la administración usan el verde de `:root`. `setTema()` en `app.js` pone el atributo según la entidad de la sesión. Use siempre `var(--accent)` y compañía, nunca colores fijos. El título del menú lateral es el nombre de la entidad.

**Rutas de la interfaz (hash):** `#/inicio`, `#/clientes`, `#/clientes/:id`, `#/cuentas`, `#/cuentas/nueva`,
`#/cuentas/:iban`, `#/telefonos`, `#/sinpe`, `#/sinpe/historial/:numero`, `#/transferir`, `#/transferir/iban`,
`#/transferir/confirmar`, `#/transferir/resultado`, `#/movimientos`, `#/catalogos`, `#/login`.

**API principal:** `/api/entidades-login`, `/api/login`, `/api/mis-movimientos`, `/api/resumen`, `/api/clientes`, `/api/cuentas`, `/api/cuentas/:iban/estado`,
`/api/telefonos`, `/api/telefonos/:numero/titular`, `/api/sinpe/{afiliar,desafiliar,trasladar,historial/:n}`,
`/api/transferencias/{sinpe,iban}`, `/api/movimientos`, `/api/conservacion`, `/api/catalogos`, `/api/entidades`,
`/api/buscar/{telefono,iban}/:x`.

## 5. Datos de prueba (escenario)

| Cliente | Cuentas | Teléfonos |
|---|---|---|
| Ana Rodríguez Mora (1-1234-0567) | CR21…7890 CRC "IBAN 001" · CR54…6667 CRC · CR47…3210 USD | 88881111 y 88882222 → IBAN 001 · 87776666 sin afiliar |
| Carlos Jiménez Solís (2-0456-0789) | CR63…2223 CRC "IBAN 002" (Banco Volcán) | 88883333 → IBAN 002 |
| María Fernández Vargas (1-0987-0654) | CR88…9990 CRC (Cooperativa Arenal) | 83334444 afiliado |
| José Ramírez Castro (INACTIVO) | CR12…5556 INACTIVA | 60001234 sin afiliar |
| Laura Chaves Quesada | CR35…4445 BLOQUEADA | 71112222 sin afiliar |

Saldos esperados después de `05_datos.sql`: Ana ₡850.000, Carlos ₡420.500 y María ₡1.200.000. El total en colones
de las cuentas participantes se conserva (₡2.470.500 antes y después).

## 6. Pendientes e ideas para seguir

Prioridad para la entrega del 9 de noviembre:
- [ ] Cada integrante clona, instala y ejecuta `npm run pruebas-bd` en su máquina.
- [ ] Probar a mano en la interfaz los formularios que no se han recorrido de punta a punta en el navegador:
  crear cliente, cuenta y teléfono, afiliar, trasladar (válido y a la cuenta USD para ver la reversión),
  desafiliar, cambiar estado de cuenta y cambiar titular.
- [ ] Preparar la defensa: recorrer la tabla "Dónde está cada requisito" del `app/README.md` y explicar la
  justificación del trigger 4 (comentario en `02_triggers.sql`).
- [ ] Integrantes del grupo en el README (nombres y carnés).

Opcionales:
- [ ] Los datos de prueba se crean con la fecha de instalación. Para un historial repartido en varios días, se podría
  agregar una variable de sesión `@fecha_simulada` que los procedimientos usen en lugar de `NOW()` solo durante la carga.
- [ ] Desplegar en internet (por ejemplo Railway o Render con MySQL administrado) si el profesor quiere verlo en línea.
- [ ] Cambio de clave por el cliente y recuperación de contraseña (hoy la sesión está en memoria y se pierde al reiniciar el servidor).
- [ ] Exportar el comprobante de transferencia (el botón "Descargar" del prototipo no se implementó; sí hay
  exportación CSV en Movimientos y en Historial).

## 7. Historial de trabajo

- **2026-10-31:** se leyó el enunciado y se hizo el prototipo HTML (v1 en `prototipo/v1/`). Luego se rediseñó
  como "Billete de colón" aplicando las guías de diseño de Impeccable, Emil Kowalski y taste-skill. Se importó a Figma con html.to.design.
- **2026-11-02:** guía PDF de las 21 pantallas.
- **2026-11-05:** aplicación real. Esquema, triggers, procedimientos, informes, datos y pruebas en MySQL; servidor
  Express; interfaz con el diseño del prototipo. 36/36 pruebas pasan y la interfaz se revisó en Chrome.
  Problemas resueltos: `localhost` colgaba la conexión (IPv6), el puerto 3000 estaba ocupado, y el divisor SQL de
  `instalar.js` tenía una expresión regular con retroceso exponencial y no veía el `;` antes de un comentario final.
