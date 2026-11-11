# JUNTAUCR · SINPE Móvil (simulación)

Aplicación web para el proyecto de la prueba corta: clientes, cuentas IBAN, teléfonos,
afiliaciones SINPE Móvil y transferencias. Datos ficticios; no se conecta al BCCR.

- **Base de datos:** MySQL 8. Aquí están todas las reglas de negocio (tablas, triggers y procedimientos).
- **Servidor:** Node.js con Express. Solo llama a los procedimientos almacenados.
- **Interfaz:** HTML, CSS y JavaScript sin framework, con el diseño del prototipo de Figma.

## Requisitos

- MySQL Server 8.0 (o más reciente) corriendo
- Node.js 18 o más reciente

## Instalación

```bash
cd app
npm install
copy .env.example .env      # luego ponga su contraseña de MySQL en DB_PASSWORD
npm run instalar-bd         # crea la BD juntaucr_sinpe con datos de prueba
npm start                   # http://localhost:3100
```

Usuario de prueba: `admin@juntaucr.cr` / `juntaucr2026`

- `npm run pruebas-bd` reinstala la base y ejecuta las 75 pruebas de reglas de negocio (muestra la tabla PASA/FALLA).
- Para volver a los datos iniciales, ejecute `npm run instalar-bd` otra vez.
- Los scripts de `db/` también se pueden abrir y ejecutar en orden en MySQL Workbench.

> En Windows use `DB_HOST=127.0.0.1`: con `localhost` el controlador intenta IPv6 y la conexión se queda colgada.

## Dónde está cada requisito

| Requisito del enunciado | Archivo | Objeto |
|---|---|---|
| Tablas, catálogos, CHECK, UNIQUE, FK | `db/01_esquema.sql` | `cliente`, `moneda`, `entidad_financiera`, `cuenta`, `telefono`, `afiliacion_sinpe`, `historial_afiliacion`, `transferencia` |
| Trigger 1 · validación BEFORE INSERT afiliación | `db/02_triggers.sql` | `trg_afiliacion_validar_bi` |
| Trigger 2 · auditoría AFTER INSERT | `db/02_triggers.sql` | `trg_afiliacion_auditar_ai` |
| Trigger 3 · auditoría BEFORE DELETE | `db/02_triggers.sql` | `trg_afiliacion_auditar_bd` |
| Trigger 4 · validación BEFORE INSERT transferencia (+ justificación) | `db/02_triggers.sql` | `trg_transferencia_validar_bi` |
| Regla 10 · titularidad | `db/02_triggers.sql`, `db/03_procedimientos.sql` | `trg_telefono_proteger_bu`, `trg_cuenta_proteger_bu`, `sp_cambiar_titular_telefono`, `sp_cambiar_estado_cuenta` |
| Regla 9 · historial inmutable | `db/02_triggers.sql` | `trg_historial_inmutable_*`, `trg_transferencia_inmutable_*` |
| 8 procedimientos obligatorios | `db/03_procedimientos.sql` | `sp_registrar_cuenta`, `sp_registrar_telefono`, `sp_afiliar_sinpe`, `sp_desafiliar_sinpe`, `sp_cambiar_cuenta_sinpe`, `sp_transferir_sinpe`, `sp_transferir_iban`, `sp_consultar_movimientos` |
| Informe 5.1 | `db/04_consultas.sql` | vista `v_telefonos_cliente` |
| Informe 5.2 | `db/04_consultas.sql` | `sp_telefonos_por_cuenta` |
| Informe 5.3 | `db/04_consultas.sql` | `sp_historial_telefono` |
| Informe 5.4 | `db/03_procedimientos.sql` | `sp_consultar_movimientos` |
| Informe 5.5 | `db/04_consultas.sql` | `sp_totales_periodo` |
| Informe 5.6 | `db/04_consultas.sql` | `sp_comprobar_conservacion` (compara contra la evidencia guardada; detecta saldos alterados) |
| Clientes y catálogo (apoyo) | `db/03_procedimientos.sql` | `sp_registrar_cliente`, `sp_actualizar_cliente`, `sp_registrar_entidad`, `sp_renombrar_entidad` |
| Escenario de prueba | `db/05_datos.sql` | Clientes, cuentas y transferencias del prototipo |
| Pruebas de reglas | `db/06_pruebas.sql` | 75 casos, incluida la tabla de la regla 7 |

## Decisiones de diseño

- **Transacciones:** las operaciones compuestas usan `START TRANSACTION` / `COMMIT` y un `EXIT HANDLER FOR SQLEXCEPTION` que hace `ROLLBACK` y `RESIGNAL`. Los errores de negocio usan `SIGNAL SQLSTATE '45000'`.
- **Bloqueos:** las transferencias bloquean las dos cuentas con `SELECT … FOR UPDATE`, siempre empezando por el id menor, para evitar interbloqueos. `sp_transferir_sinpe` además bloquea las afiliaciones con `FOR SHARE`, para que no se desafilien a mitad de la operación.
- **SINPE Móvil como en la vida real:** `sp_transferir_sinpe(tel_origen, iban_origen, tel_destino, monto, detalle, @id)` acepta dos formas. Con `iban_origen` en NULL se debita la cuenta afiliada al teléfono de origen, como dice el enunciado (2.8). Con `iban_origen`, el cliente elige **cualquiera** de sus cuentas activas en colones y solo escribe el número de destino, como en la app de un banco. Basta con que tenga un número afiliado, en cualquier entidad: el procedimiento lo resuelve y lo registra como teléfono de origen. El destino siempre es la cuenta afiliada al número de destino y la regla 7 compara las cuentas (no se envía a un número afiliado a la misma cuenta de la que sale el dinero). La interfaz del cliente usa esta segunda forma; la administración simula con el teléfono.
- **Traslado:** `sp_cambiar_cuenta_sinpe` borra la afiliación actual (paso 1) e inserta la nueva (paso 2). La cuenta nueva se valida a propósito solo en el trigger del paso 2: si falla, el `ROLLBACK` restaura la afiliación original y su historial. En la pantalla de traslado se puede elegir una cuenta USD para ver la reversión.
- **Motivo del historial:** el procedimiento fija `@motivo_evento` (Afiliación, Traslado, Cambio de titular…) y el trigger lo copia al historial. Si la operación se hace directo sobre la tabla, queda "Operación directa".
- **Evidencia:** cada transferencia guarda el saldo de las dos cuentas después de la operación. Con eso se arma el saldo corrido de Movimientos.
- **Informe 5.6:** los saldos inicial y final no se reconstruyen desde el saldo actual (eso cuadraría siempre, por construcción). Salen de la evidencia de la primera y la última transferencia del período, y se comparan con el saldo actual de la cuenta. Si alguien cambia un saldo con un `UPDATE` directo, la cuenta dice «NO CUADRA» y el total «NO SE CONSERVA» (hay una prueba que lo demuestra).
- **Cliente inactivo:** conserva sus datos y puede recibir dinero, pero no inicia operaciones: no ingresa a la aplicación, no envía, no afilia, no abre cuentas, no registra teléfonos ni reactiva cuentas. Lo validan los procedimientos.
- **Moneda fija:** una cuenta con transferencias no puede cambiar de moneda (`trg_cuenta_proteger_bu`), porque los montos guardados quedarían en otra moneda.
- **Privacidad:** un cliente no recibe el saldo de la otra parte de una transferencia; el servidor lo quita de las respuestas.
