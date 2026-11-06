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

- `npm run pruebas-bd` reinstala la base y ejecuta las 36 pruebas de reglas de negocio (muestra la tabla PASA/FALLA).
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
| 7 procedimientos obligatorios | `db/03_procedimientos.sql` | `sp_registrar_cuenta`, `sp_registrar_telefono`, `sp_afiliar_sinpe`, `sp_desafiliar_sinpe`, `sp_cambiar_cuenta_sinpe`, `sp_transferir_sinpe`, `sp_transferir_iban`, `sp_consultar_movimientos` |
| Informe 5.1 | `db/04_consultas.sql` | vista `v_telefonos_cliente` |
| Informe 5.2 | `db/04_consultas.sql` | `sp_telefonos_por_cuenta` |
| Informe 5.3 | `db/04_consultas.sql` | `sp_historial_telefono` |
| Informe 5.4 | `db/03_procedimientos.sql` | `sp_consultar_movimientos` |
| Informe 5.5 | `db/04_consultas.sql` | `sp_totales_periodo` |
| Informe 5.6 | `db/04_consultas.sql` | `sp_comprobar_conservacion` |
| Escenario de prueba | `db/05_datos.sql` | Clientes, cuentas y transferencias del prototipo |
| Pruebas de reglas | `db/06_pruebas.sql` | 36 casos, incluida la tabla de la regla 7 |

## Decisiones de diseño

- **Transacciones:** las operaciones compuestas usan `START TRANSACTION` / `COMMIT` y un `EXIT HANDLER FOR SQLEXCEPTION` que hace `ROLLBACK` y `RESIGNAL`. Los errores de negocio usan `SIGNAL SQLSTATE '45000'`.
- **Bloqueos:** las transferencias bloquean las dos cuentas con `SELECT … FOR UPDATE`, siempre empezando por el id menor, para evitar interbloqueos. `sp_transferir_sinpe` además bloquea las afiliaciones con `FOR SHARE`, para que no se desafilien a mitad de la operación.
- **Traslado:** `sp_cambiar_cuenta_sinpe` borra la afiliación actual (paso 1) e inserta la nueva (paso 2). La cuenta nueva se valida a propósito solo en el trigger del paso 2: si falla, el `ROLLBACK` restaura la afiliación original y su historial. En la pantalla de traslado se puede elegir una cuenta USD para ver la reversión.
- **Motivo del historial:** el procedimiento fija `@motivo_evento` (Afiliación, Traslado, Cambio de titular…) y el trigger lo copia al historial. Si la operación se hace directo sobre la tabla, queda "Operación directa".
- **Evidencia:** cada transferencia guarda el saldo de las dos cuentas después de la operación. Con eso se arma el saldo corrido de Movimientos.
