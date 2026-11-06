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
CALL sp_probar('R7 · 88881111 → 88882222 (misma cuenta)', "CALL sp_transferir_sinpe('88881111', '88882222', 1000, 'prueba', @x)", 'ERROR');
CALL sp_probar('R7 · 88881111 → 88883333 (otra cuenta)',  "CALL sp_transferir_sinpe('88881111', '88883333', 1000, 'prueba', @x)", 'OK');
CALL sp_probar('R7 · IBAN 001 → IBAN 001',                "CALL sp_transferir_iban('CR21015200001234567890', 'CR21015200001234567890', 1000, 'prueba', @x)", 'ERROR');
CALL sp_probar('R7 · IBAN 001 → IBAN 002',                "CALL sp_transferir_iban('CR21015200001234567890', 'CR63081400005551112223', 1000, 'prueba', @x)", 'OK');
-- Regla 8 · activas, monto positivo, saldo, misma moneda
CALL sp_probar('R8 · monto cero',                  "CALL sp_transferir_iban('CR21015200001234567890', 'CR63081400005551112223', 0, 'prueba', @x)", 'ERROR');
CALL sp_probar('R8 · monto negativo',              "CALL sp_transferir_sinpe('88881111', '88883333', -50, 'prueba', @x)", 'ERROR');
CALL sp_probar('R8 · saldo insuficiente',          "CALL sp_transferir_sinpe('88883333', '83334444', 999999999, 'prueba', @x)", 'ERROR');
CALL sp_probar('R8 · IBAN con monedas distintas',  "CALL sp_transferir_iban('CR21015200001234567890', 'CR47015200009876543210', 1000, 'prueba', @x)", 'ERROR');
CALL sp_probar('R8 · destino INACTIVA',            "CALL sp_transferir_iban('CR21015200001234567890', 'CR12015200003334445556', 1000, 'prueba', @x)", 'ERROR');
CALL sp_probar('R8 · teléfono destino sin afiliar',"CALL sp_transferir_sinpe('88881111', '87776666', 1000, 'prueba', @x)", 'ERROR');
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

SELECT n, caso, esperado, obtenido, resultado, mensaje FROM resultado_prueba ORDER BY n;
SELECT SUM(resultado = 'PASA') AS pasan, SUM(resultado = 'FALLA') AS fallan FROM resultado_prueba;

DROP PROCEDURE IF EXISTS sp_probar;
DROP PROCEDURE IF EXISTS sp_afirmar;
