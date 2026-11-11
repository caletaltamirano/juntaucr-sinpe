-- =====================================================================
--  JUNTAUCR · SINPE Móvil
--  06 · Pruebas de las reglas de negocio
--
--  Cada caso ejecuta una operación y anota si terminó bien o con error.
--  Al final se muestra una tabla: caso, esperado, obtenido y si PASA.
--  Ejecutar después de 05_datos.sql (sí modifica datos: las pruebas que
--  deben pasar hacen transferencias reales del escenario).
-- =====================================================================
USE juntaucr_sinpe;

DROP TEMPORARY TABLE IF EXISTS resultado_prueba;
CREATE TEMPORARY TABLE resultado_prueba (
  n         INT AUTO_INCREMENT PRIMARY KEY,
  caso      VARCHAR(120),
  esperado  VARCHAR(5),
  obtenido  VARCHAR(5),
  mensaje   VARCHAR(255),
  resultado VARCHAR(8)
);

DELIMITER $$
DROP PROCEDURE IF EXISTS sp_probar$$
CREATE PROCEDURE sp_probar(IN p_caso VARCHAR(120), IN p_sql TEXT, IN p_esperado VARCHAR(5))
BEGIN
  DECLARE v_estado VARCHAR(5) DEFAULT 'OK';
  DECLARE v_msg    VARCHAR(255) DEFAULT '';
  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
    BEGIN
      GET DIAGNOSTICS CONDITION 1 v_msg = MESSAGE_TEXT;
      SET v_estado = 'ERROR';
    END;
    SET @sql_prueba = p_sql;
    PREPARE st FROM @sql_prueba;
    EXECUTE st;
    DEALLOCATE PREPARE st;
  END;
  INSERT INTO resultado_prueba (caso, esperado, obtenido, mensaje, resultado)
  VALUES (p_caso, p_esperado, v_estado, v_msg, IF(v_estado = p_esperado, 'PASA', 'FALLA'));
END$$
DROP PROCEDURE IF EXISTS sp_afirmar$$
CREATE PROCEDURE sp_afirmar(IN p_condicion BOOLEAN)
BEGIN
  IF NOT COALESCE(p_condicion, FALSE) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La comprobación no se cumple.';
  END IF;
END$$
DELIMITER ;

-- Regla 2 · teléfono único y de 8 dígitos
CALL sp_probar('R2 · teléfono duplicado',          "CALL sp_registrar_telefono('88881111', '2-0456-0789', @t)", 'ERROR');
CALL sp_probar('R2 · teléfono de 7 dígitos',       "CALL sp_registrar_telefono('8888111', '2-0456-0789', @t)",  'ERROR');
CALL sp_probar('R2 · teléfono con letras',         "CALL sp_registrar_telefono('8888ABCD', '2-0456-0789', @t)", 'ERROR');
-- Regla 3 · registrar no afilia
CALL sp_probar('R3 · registrar teléfono nuevo',    "CALL sp_registrar_telefono('62223333', '2-0456-0789', @t)", 'OK');
CALL sp_probar('R3 · el nuevo no queda afiliado',  "CALL sp_afirmar((SELECT afiliado FROM v_telefonos_cliente WHERE numero='62223333') = 'NO')", 'OK');
-- Regla 4 · titular distinto
CALL sp_probar('R4 · afiliar a cuenta de otro titular', "CALL sp_afiliar_sinpe('62223333', 'CR21015200001234567890')", 'ERROR');
CALL sp_probar('R4 · insert directo de otro titular (trigger)',
  "INSERT INTO afiliacion_sinpe (id_telefono, id_cuenta) SELECT t.id_telefono, c.id_cuenta FROM telefono t, cuenta c WHERE t.numero='62223333' AND c.iban='CR21015200001234567890'", 'ERROR');
-- Regla 5 · una sola afiliación vigente
CALL sp_probar('R5 · afiliar teléfono ya afiliado', "CALL sp_afiliar_sinpe('88882222', 'CR54015200004445556667')", 'ERROR');
-- Regla 6 · solo cuentas activas en CRC
CALL sp_probar('R6 · afiliar a cuenta USD',        "CALL sp_afiliar_sinpe('87776666', 'CR47015200009876543210')", 'ERROR');
CALL sp_probar('R6 · afiliar a cuenta BLOQUEADA',  "CALL sp_afiliar_sinpe('71112222', 'CR35081400002223334445')", 'ERROR');
CALL sp_probar('R6 · afiliar a cuenta válida',     "CALL sp_afiliar_sinpe('62223333', 'CR63081400005551112223')", 'OK');
-- Regla 7 · tabla del enunciado
CALL sp_probar('R7 · 88881111 → 88882222 (misma cuenta)', "CALL sp_transferir_sinpe('88881111', NULL, '88882222', 1000, 'prueba', @x)", 'ERROR');
CALL sp_probar('R7 · 88881111 → 88883333 (otra cuenta)',  "CALL sp_transferir_sinpe('88881111', NULL, '88883333', 1000, 'prueba', @x)", 'OK');
CALL sp_probar('R7 · IBAN 001 → IBAN 001',                "CALL sp_transferir_iban('CR21015200001234567890', 'CR21015200001234567890', 1000, 'prueba', @x)", 'ERROR');
CALL sp_probar('R7 · IBAN 001 → IBAN 002',                "CALL sp_transferir_iban('CR21015200001234567890', 'CR63081400005551112223', 1000, 'prueba', @x)", 'OK');
-- Regla 8 · activas, monto positivo, saldo, misma moneda
CALL sp_probar('R8 · monto cero',                  "CALL sp_transferir_iban('CR21015200001234567890', 'CR63081400005551112223', 0, 'prueba', @x)", 'ERROR');
CALL sp_probar('R8 · monto negativo',              "CALL sp_transferir_sinpe('88881111', NULL, '88883333', -50, 'prueba', @x)", 'ERROR');
CALL sp_probar('R8 · saldo insuficiente',          "CALL sp_transferir_sinpe('88883333', NULL, '83334444', 999999999, 'prueba', @x)", 'ERROR');
CALL sp_probar('R8 · IBAN con monedas distintas',  "CALL sp_transferir_iban('CR21015200001234567890', 'CR47015200009876543210', 1000, 'prueba', @x)", 'ERROR');
CALL sp_probar('R8 · destino INACTIVA',            "CALL sp_transferir_iban('CR21015200001234567890', 'CR12015200003334445556', 1000, 'prueba', @x)", 'ERROR');
CALL sp_probar('R8 · teléfono destino sin afiliar',"CALL sp_transferir_sinpe('88881111', NULL, '87776666', 1000, 'prueba', @x)", 'ERROR');
-- SINPE Móvil como en la vida real: el cliente elige cualquier cuenta suya y solo escribe el número de destino
CALL sp_probar('SINPE real · desde CR54 (sin números afiliados) → 88883333',
  "CALL sp_transferir_sinpe(NULL, 'CR54015200004445556667', '88883333', 2000, 'prueba', @x)", 'OK');
CALL sp_probar('SINPE real · se registró como SINPE, debitó CR54 y usó 88881111 de origen',
  "CALL sp_afirmar((SELECT COUNT(*) FROM v_transferencias WHERE id_transferencia = @x AND tipo = 'SINPE' AND iban_origen = 'CR54015200004445556667' AND telefono_origen = '88881111') = 1)", 'OK');
CALL sp_probar('SINPE real · de CR54 a su propio 88881111 (cuentas distintas)',
  "CALL sp_transferir_sinpe(NULL, 'CR54015200004445556667', '88881111', 1000, 'prueba', @x)", 'OK');
CALL sp_probar('SINPE real · usó 88882222 de origen, no el mismo número de destino',
  "CALL sp_afirmar((SELECT telefono_origen FROM v_transferencias WHERE id_transferencia = @x) = '88882222')", 'OK');
CALL sp_probar('SINPE real · IBAN 001 → 88882222 (afiliado a la misma cuenta)',
  "CALL sp_transferir_sinpe(NULL, 'CR21015200001234567890', '88882222', 1000, 'prueba', @x)", 'ERROR');
CALL sp_probar('SINPE real · desde la cuenta en USD',
  "CALL sp_transferir_sinpe(NULL, 'CR47015200009876543210', '88883333', 10, 'prueba', @x)", 'ERROR');
CALL sp_probar('SINPE real · número de origen sin afiliar (87776666)',
  "CALL sp_transferir_sinpe('87776666', 'CR54015200004445556667', '88883333', 1000, 'prueba', @x)", 'ERROR');
CALL sp_probar('SINPE real · número propio con cuenta de otro titular',
  "CALL sp_transferir_sinpe('88881111', 'CR63081400005551112223', '83334444', 1000, 'prueba', @x)", 'ERROR');
CALL sp_probar('SINPE real · titular sin ningún número afiliado (Laura)',
  "CALL sp_transferir_sinpe(NULL, 'CR35081400002223334445', '88883333', 1000, 'prueba', @x)", 'ERROR');
-- Trigger 4 · validación directa de transferencia
CALL sp_probar('T4 · insert directo monto 0 (trigger)',
  "INSERT INTO transferencia (tipo, id_cuenta_origen, id_cuenta_destino, monto, saldo_origen_despues, saldo_destino_despues) VALUES ('IBAN', 1, 4, 0, 0, 0)", 'ERROR');
CALL sp_probar('T4 · insert directo misma cuenta (trigger)',
  "INSERT INTO transferencia (tipo, id_cuenta_origen, id_cuenta_destino, monto, saldo_origen_despues, saldo_destino_despues) VALUES ('IBAN', 1, 1, 10, 0, 0)", 'ERROR');
-- 2.6 · traslado con recuperación: el paso 2 falla (cuenta USD) y la afiliación original se recupera
CALL sp_probar('2.6 · traslado a cuenta USD se revierte', "CALL sp_cambiar_cuenta_sinpe('88882222', 'CR47015200009876543210')", 'ERROR');
CALL sp_probar('2.6 · 88882222 sigue en su cuenta original',
  "CALL sp_afirmar((SELECT iban_afiliado FROM v_telefonos_cliente WHERE numero='88882222') = 'CR21015200001234567890')", 'OK');
CALL sp_probar('2.6 · traslado válido a otra cuenta de Ana', "CALL sp_cambiar_cuenta_sinpe('88882222', 'CR54015200004445556667')", 'OK');
CALL sp_probar('2.7 · el traslado dejó DESAFILIACION + AFILIACION',
  "CALL sp_afirmar((SELECT COUNT(*) FROM historial_afiliacion h JOIN telefono t USING (id_telefono) WHERE t.numero='88882222' AND h.motivo='Traslado') = 2)", 'OK');
-- Regla 10 · titularidad con afiliaciones vigentes
CALL sp_probar('R10 · cambiar titular de teléfono afiliado (directo)', "UPDATE telefono SET id_cliente = 3 WHERE numero = '88881111'", 'ERROR');
CALL sp_probar('R10 · cambiar titular de cuenta con afiliados',        "UPDATE cuenta SET id_cliente = 3 WHERE iban = 'CR21015200001234567890'", 'ERROR');
CALL sp_probar('R10 · bloquear cuenta con afiliados sin confirmar',    "CALL sp_cambiar_estado_cuenta('CR63081400005551112223', 'BLOQUEADA', FALSE)", 'ERROR');
CALL sp_probar('R10 · cambio de titular controlado',                   "CALL sp_cambiar_titular_telefono('87776666', '2-0456-0789')", 'OK');
-- Regla 9 · evidencia histórica inmutable
CALL sp_probar('R9 · borrar historial',            "DELETE FROM historial_afiliacion WHERE id_historial = 1", 'ERROR');
CALL sp_probar('R9 · modificar transferencia',     "UPDATE transferencia SET monto = 1 WHERE id_transferencia = 1", 'ERROR');
-- 2.3 · IBAN de 22 caracteres y saldo no negativo
CALL sp_probar('2.3 · IBAN de 21 caracteres',      "CALL sp_registrar_cuenta('CR2101520000123456789', '1-1234-0567', '0152', 'CRC', 0, NULL, 'ACTIVA', @a)", 'ERROR');
CALL sp_probar('2.3 · saldo inicial negativo',     "CALL sp_registrar_cuenta('CR99015200000000000001', '1-1234-0567', '0152', 'CRC', -1, NULL, 'ACTIVA', @a)", 'ERROR');
CALL sp_probar('2.3 · saldo negativo directo (CHECK)', "UPDATE cuenta SET saldo = -1 WHERE iban = 'CR54015200004445556667'", 'ERROR');

-- Acceso de clientes: el cliente nuevo recibe su usuario y la clave debe ser válida
CALL sp_probar('Acceso · cliente nuevo con clave corta', "CALL sp_registrar_cliente('9-9999-0001', 'Prueba Acceso', 'acceso@correo.cr', '123', @x)", 'ERROR');
CALL sp_probar('Acceso · cliente nuevo crea su usuario', "CALL sp_registrar_cliente('9-9999-0002', 'Prueba Acceso', 'acceso2@correo.cr', 'clave123', @x)", 'OK');
CALL sp_probar('Acceso · el usuario quedó ligado al cliente',
  "CALL sp_afirmar((SELECT COUNT(*) FROM usuario WHERE correo = 'acceso2@correo.cr' AND rol = 'CLIENTE' AND id_cliente IS NOT NULL) = 1)", 'OK');

-- Regla 9 · una transferencia rechazada no deja rastro en el saldo
CALL sp_probar('R9 · guardar saldo de IBAN 001', "SET @saldo_antes = (SELECT saldo FROM cuenta WHERE iban = 'CR21015200001234567890')", 'OK');
CALL sp_probar('R9 · transferencia rechazada (saldo insuficiente)', "CALL sp_transferir_iban('CR21015200001234567890', 'CR63081400005551112223', 999999999, 'prueba', @x)", 'ERROR');
CALL sp_probar('R9 · el saldo de origen no cambió',
  "CALL sp_afirmar((SELECT saldo FROM cuenta WHERE iban = 'CR21015200001234567890') = @saldo_antes)", 'OK');
-- Regla 8 · origen no activo
CALL sp_probar('R8 · origen BLOQUEADA por IBAN', "CALL sp_transferir_iban('CR35081400002223334445', 'CR63081400005551112223', 1000, 'prueba', @x)", 'ERROR');
-- Moneda fija si la cuenta ya tiene transferencias
CALL sp_probar('2.3 · cambiar moneda de cuenta con transferencias', "UPDATE cuenta SET id_moneda = 2 WHERE iban = 'CR63081400005551112223'", 'ERROR');
-- Informes 5.4 y 5.5 · período inválido
CALL sp_probar('5.4 · movimientos con período invertido', "CALL sp_consultar_movimientos('CR21015200001234567890', '2026-12-31', '2026-01-01')", 'ERROR');
-- Informe 5.6 · detecta un saldo alterado fuera de una transferencia
CALL sp_probar('5.6 · conservación sin alteraciones',
  "CALL sp_comprobar_conservacion('2000-01-01', CURDATE())", 'OK');
CALL sp_probar('5.6 · el informe dice SE CONSERVA', "CALL sp_afirmar(@conservacion = 'SE CONSERVA')", 'OK');
CALL sp_probar('5.6 · alterar el saldo de María con UPDATE directo',
  "UPDATE cuenta SET saldo = saldo + 1000000 WHERE iban = 'CR88090100007778889990'", 'OK');
CALL sp_probar('5.6 · conservación con saldo alterado',
  "CALL sp_comprobar_conservacion('2000-01-01', CURDATE())", 'OK');
CALL sp_probar('5.6 · el informe dice NO SE CONSERVA', "CALL sp_afirmar(@conservacion = 'NO SE CONSERVA')", 'OK');
CALL sp_probar('5.6 · devolver el saldo de María',
  "UPDATE cuenta SET saldo = saldo - 1000000 WHERE iban = 'CR88090100007778889990'", 'OK');
-- sp_desafiliar_sinpe · deja evidencia y rechaza un teléfono sin afiliación
CALL sp_probar('Desafiliar · 88883333', "CALL sp_desafiliar_sinpe('88883333')", 'OK');
CALL sp_probar('Desafiliar · quedó el evento DESAFILIACION',
  "CALL sp_afirmar((SELECT COUNT(*) FROM historial_afiliacion h JOIN telefono t USING (id_telefono) WHERE t.numero='88883333' AND h.tipo_evento='DESAFILIACION') = 1)", 'OK');
CALL sp_probar('Desafiliar · teléfono sin afiliación', "CALL sp_desafiliar_sinpe('88883333')", 'ERROR');

-- Cliente INACTIVO: conserva sus datos y puede recibir, pero no inicia operaciones
CALL sp_probar('Inactivo · inactivar a María (procedimiento)', "CALL sp_actualizar_cliente('1-0987-0654', 'María Fernández Vargas', 'maria.fv@correo.cr', 'INACTIVO')", 'OK');
CALL sp_probar('Inactivo · no puede enviar por SINPE',  "CALL sp_transferir_sinpe('83334444', NULL, '88881111', 1000, 'prueba', @x)", 'ERROR');
CALL sp_probar('Inactivo · no puede enviar por IBAN',   "CALL sp_transferir_iban('CR88090100007778889990', 'CR21015200001234567890', 1000, 'prueba', @x)", 'ERROR');
CALL sp_probar('Inactivo · sí puede recibir',           "CALL sp_transferir_iban('CR21015200001234567890', 'CR88090100007778889990', 1000, 'prueba', @x)", 'OK');
CALL sp_probar('Inactivo · no reactiva cuentas (José)', "CALL sp_cambiar_estado_cuenta('CR12015200003334445556', 'ACTIVA', FALSE)", 'ERROR');
CALL sp_probar('Inactivo · reactivar a María',          "CALL sp_actualizar_cliente('1-0987-0654', 'María Fernández Vargas', 'maria.fv@correo.cr', 'ACTIVO')", 'OK');
CALL sp_probar('Cliente · correo inválido',             "CALL sp_actualizar_cliente('1-0987-0654', 'María Fernández Vargas', 'sin-arroba', 'ACTIVO')", 'ERROR');
CALL sp_probar('Cliente · correo de otro cliente',      "CALL sp_actualizar_cliente('1-0987-0654', 'María Fernández Vargas', 'ana.rodriguez@correo.cr', 'ACTIVO')", 'ERROR');
-- Catálogo de entidades
CALL sp_probar('Entidad · registrar 0999',              "CALL sp_registrar_entidad('0999', 'Banco de Prueba')", 'OK');
CALL sp_probar('Entidad · código repetido',             "CALL sp_registrar_entidad('0999', 'Otro nombre')", 'ERROR');
CALL sp_probar('Entidad · código de 3 dígitos',         "CALL sp_registrar_entidad('099', 'Banco Corto')", 'ERROR');
CALL sp_probar('Entidad · renombrar a un nombre usado', "CALL sp_renombrar_entidad('0999', 'JUNTAUCR')", 'ERROR');

SELECT n, caso, esperado, obtenido, resultado, mensaje FROM resultado_prueba ORDER BY n;
SELECT SUM(resultado = 'PASA') AS pasan, SUM(resultado = 'FALLA') AS fallan FROM resultado_prueba;

DROP PROCEDURE IF EXISTS sp_probar;
DROP PROCEDURE IF EXISTS sp_afirmar;
