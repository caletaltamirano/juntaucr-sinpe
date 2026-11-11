-- =====================================================================
--  JUNTAUCR · SINPE Móvil
--  02 · Triggers
--
--  Ningún trigger contiene COMMIT ni ROLLBACK: lo que escriben (auditoría)
--  participa en la transacción de la operación que los dispara. Si esa
--  operación se revierte, sus registros de auditoría también.
--
--  El motivo de cada evento de historial lo fija el procedimiento que
--  opera (variable de sesión @motivo_evento, p. ej. 'Traslado'); si se
--  opera directamente sobre la tabla queda 'Operación directa'.
-- =====================================================================
USE juntaucr_sinpe;

DELIMITER $$

-- ---------------------------------------------------------------------
-- Trigger obligatorio 1 · Validación BEFORE INSERT de afiliacion_sinpe
--   Impide: cuenta no activa, moneda distinta de CRC y titularidad diferente.
--   Es la última barrera: aunque alguien inserte sin pasar por
--   sp_afiliar_sinpe, la regla se cumple.
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_afiliacion_validar_bi
BEFORE INSERT ON afiliacion_sinpe
FOR EACH ROW
BEGIN
  DECLARE v_estado       VARCHAR(10);
  DECLARE v_moneda       CHAR(3);
  DECLARE v_titular_cta  INT UNSIGNED;
  DECLARE v_titular_tel  INT UNSIGNED;

  SELECT c.estado, m.codigo, c.id_cliente
    INTO v_estado, v_moneda, v_titular_cta
    FROM cuenta c
    JOIN moneda m ON m.id_moneda = c.id_moneda
   WHERE c.id_cuenta = NEW.id_cuenta;

  SELECT t.id_cliente INTO v_titular_tel
    FROM telefono t
   WHERE t.id_telefono = NEW.id_telefono;

  IF v_estado IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta indicada no existe.';
  END IF;
  IF v_titular_tel IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono indicado no está registrado.';
  END IF;
  IF v_estado <> 'ACTIVA' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se puede afiliar a una cuenta ACTIVA.';
  END IF;
  IF v_moneda <> 'CRC' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se puede afiliar a una cuenta en colones (CRC).';
  END IF;
  IF v_titular_cta <> v_titular_tel THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono y la cuenta deben pertenecer al mismo cliente.';
  END IF;

  SET NEW.fecha_afiliacion = NOW();
END$$

-- ---------------------------------------------------------------------
-- Trigger obligatorio 2 · Auditoría AFTER INSERT de afiliacion_sinpe
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_afiliacion_auditar_ai
AFTER INSERT ON afiliacion_sinpe
FOR EACH ROW
BEGIN
  INSERT INTO historial_afiliacion (id_telefono, id_cuenta, tipo_evento, fecha_evento, motivo)
  VALUES (NEW.id_telefono, NEW.id_cuenta, 'AFILIACION', NEW.fecha_afiliacion,
          COALESCE(@motivo_evento, 'Operación directa'));
END$$

-- ---------------------------------------------------------------------
-- Trigger obligatorio 3 · Auditoría BEFORE DELETE de afiliacion_sinpe
--   Se ejecuta antes de borrar, cuando todavía existen los datos (OLD).
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_afiliacion_auditar_bd
BEFORE DELETE ON afiliacion_sinpe
FOR EACH ROW
BEGIN
  INSERT INTO historial_afiliacion (id_telefono, id_cuenta, tipo_evento, fecha_evento, motivo)
  VALUES (OLD.id_telefono, OLD.id_cuenta, 'DESAFILIACION', NOW(),
          COALESCE(@motivo_evento, 'Operación directa'));
END$$

-- ---------------------------------------------------------------------
-- Trigger obligatorio 4 · Validación BEFORE INSERT de transferencia
--   Rechaza monto no positivo y cuentas iguales.
--
--   Justificación de las validaciones que quedan en los procedimientos
--   (sp_transferir_sinpe / sp_transferir_iban) y NO aquí:
--   * Estado ACTIVA, moneda y saldo suficiente se deben comprobar sobre
--     las filas de cuenta ya BLOQUEADAS con SELECT ... FOR UPDATE, antes
--     de debitar y acreditar. Cuando se inserta la transferencia el saldo
--     ya fue modificado, así que el trigger llegaría tarde.
--   * Resolver teléfono → afiliación → cuenta y verificar titularidad
--     requiere los parámetros de entrada (números de teléfono), que el
--     trigger no recibe.
--   * Los mensajes de error del procedimiento son específicos para el
--     usuario; el trigger es la red de seguridad para inserciones directas.
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_transferencia_validar_bi
BEFORE INSERT ON transferencia
FOR EACH ROW
BEGIN
  IF NEW.monto IS NULL OR NEW.monto <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El monto de la transferencia debe ser mayor que cero.';
  END IF;
  IF NEW.id_cuenta_origen = NEW.id_cuenta_destino THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta de origen y la de destino no pueden ser la misma.';
  END IF;
  SET NEW.fecha = NOW();
END$$

-- =====================================================================
--  Triggers adicionales
-- =====================================================================

-- Regla 10 · Teléfono: no cambiar titular ni número mientras esté afiliado.
--   El cambio controlado se hace con sp_cambiar_titular_telefono.
CREATE TRIGGER trg_telefono_proteger_bu
BEFORE UPDATE ON telefono
FOR EACH ROW
BEGIN
  IF (NEW.id_cliente <> OLD.id_cliente OR NEW.numero <> OLD.numero)
     AND EXISTS (SELECT 1 FROM afiliacion_sinpe WHERE id_telefono = OLD.id_telefono) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El teléfono tiene una afiliación vigente: desafílielo antes de cambiar titular o número.';
  END IF;
END$$

-- Regla 10 · Cuenta: no cambiar titular, moneda ni IBAN, ni dejarla no activa,
--   mientras tenga teléfonos afiliados (dejaría afiliaciones inválidas).
--   El cambio de estado controlado se hace con sp_cambiar_estado_cuenta.
CREATE TRIGGER trg_cuenta_proteger_bu
BEFORE UPDATE ON cuenta
FOR EACH ROW
BEGIN
  IF NEW.iban <> OLD.iban THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El IBAN de una cuenta no se puede modificar.';
  END IF;
  -- La moneda no cambia si ya hay transferencias: los montos guardados quedarían en otra moneda.
  IF NEW.id_moneda <> OLD.id_moneda
     AND EXISTS (SELECT 1 FROM transferencia WHERE id_cuenta_origen = OLD.id_cuenta OR id_cuenta_destino = OLD.id_cuenta) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta ya tiene transferencias: su moneda no se puede cambiar.';
  END IF;
  IF (NEW.id_cliente <> OLD.id_cliente
      OR NEW.id_moneda <> OLD.id_moneda
      OR (NEW.estado <> 'ACTIVA' AND OLD.estado = 'ACTIVA'))
     AND EXISTS (SELECT 1 FROM afiliacion_sinpe WHERE id_cuenta = OLD.id_cuenta) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La cuenta tiene teléfonos afiliados: el cambio dejaría afiliaciones inválidas.';
  END IF;
END$$

-- Regla 9 · La evidencia histórica confirmada no se modifica ni se borra.
CREATE TRIGGER trg_historial_inmutable_bu
BEFORE UPDATE ON historial_afiliacion
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial de afiliaciones no se puede modificar.';
END$$

CREATE TRIGGER trg_historial_inmutable_bd
BEFORE DELETE ON historial_afiliacion
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial de afiliaciones no se puede borrar.';
END$$

CREATE TRIGGER trg_transferencia_inmutable_bu
BEFORE UPDATE ON transferencia
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una transferencia confirmada no se puede modificar.';
END$$

CREATE TRIGGER trg_transferencia_inmutable_bd
BEFORE DELETE ON transferencia
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una transferencia confirmada no se puede borrar.';
END$$

-- Si cambia el correo o el nombre del cliente, su usuario de ingreso se mantiene al día.
CREATE TRIGGER trg_cliente_sincronizar_usuario_au
AFTER UPDATE ON cliente
FOR EACH ROW
BEGIN
  UPDATE usuario SET correo = NEW.correo, nombre = NEW.nombre_completo
   WHERE id_cliente = NEW.id_cliente;
END$$

DELIMITER ;
