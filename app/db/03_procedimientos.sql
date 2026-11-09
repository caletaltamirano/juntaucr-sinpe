-- =====================================================================
--  JUNTAUCR · SINPE Móvil
--  03 · Procedimientos almacenados
--
--  Convenciones:
--  * Errores de negocio: SIGNAL SQLSTATE '45000' con mensaje en español.
--  * Operaciones compuestas: START TRANSACTION ... COMMIT, con
--    EXIT HANDLER FOR SQLEXCEPTION que hace ROLLBACK y RESIGNAL (el error
--    original llega intacto a la aplicación).
--  * Los parámetros usan llaves naturales (IBAN, número, identificación,
--    código de entidad/moneda) para que los scripts de prueba se lean solos.
-- =====================================================================
USE juntaucr_sinpe;

DELIMITER $$

-- ---------------------------------------------------------------------
-- Clientes (apoyo a 2.1)
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_registrar_cliente$$
CREATE PROCEDURE sp_registrar_cliente(
  IN  p_identificacion VARCHAR(20),
  IN  p_nombre         VARCHAR(120),
  IN  p_correo         VARCHAR(120),
  IN  p_clave          VARCHAR(60),
  OUT p_id_cliente     INT UNSIGNED)
BEGIN
  DECLARE v_sal CHAR(16);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET p_identificacion = TRIM(p_identificacion);
  SET p_nombre = TRIM(p_nombre);
  SET p_correo = LOWER(TRIM(p_correo));

  IF p_identificacion IS NULL OR p_identificacion = '' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La identificación es obligatoria.';
  END IF;
  IF p_nombre IS NULL OR CHAR_LENGTH(p_nombre) < 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El nombre completo es obligatorio.';
  END IF;
  IF p_correo IS NULL OR p_correo NOT LIKE '%_@_%._%' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El correo electrónico no es válido.';
  END IF;
  IF p_clave IS NULL OR CHAR_LENGTH(p_clave) < 6 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La clave inicial debe tener al menos 6 caracteres.';
  END IF;
  IF EXISTS (SELECT 1 FROM cliente WHERE identificacion = p_identificacion) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ya existe un cliente con esa identificación.';
  END IF;
  IF EXISTS (SELECT 1 FROM cliente WHERE correo = p_correo)
     OR EXISTS (SELECT 1 FROM usuario WHERE correo = p_correo) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ya existe un cliente con ese correo.';
  END IF;

  START TRANSACTION;

  INSERT INTO cliente (identificacion, nombre_completo, correo)
  VALUES (p_identificacion, p_nombre, p_correo);
  SET p_id_cliente = LAST_INSERT_ID();

  -- Credenciales de ingreso del cliente (la administración entrega la clave inicial)
  SET v_sal = SUBSTRING(SHA2(CONCAT(RAND(), UUID()), 256), 1, 16);
  INSERT INTO usuario (correo, nombre, sal, clave_hash, rol, id_cliente)
  VALUES (p_correo, p_nombre, v_sal, SHA2(CONCAT(v_sal, p_clave), 256), 'CLIENTE', p_id_cliente);

  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- sp_registrar_cuenta · Crear cuenta y validar titular, entidad, moneda e IBAN
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_registrar_cuenta$$
CREATE PROCEDURE sp_registrar_cuenta(
  IN  p_iban            VARCHAR(40),
  IN  p_identificacion  VARCHAR(20),
  IN  p_codigo_entidad  CHAR(4),
  IN  p_codigo_moneda   CHAR(3),
  IN  p_saldo_inicial   DECIMAL(18,2),
  IN  p_fecha_apertura  DATE,
  IN  p_estado          VARCHAR(10),
  OUT p_id_cuenta       INT UNSIGNED)
BEGIN
  DECLARE v_id_cliente INT UNSIGNED;
  DECLARE v_estado_cli VARCHAR(10);
  DECLARE v_id_entidad SMALLINT UNSIGNED;
  DECLARE v_id_moneda  TINYINT UNSIGNED;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  -- normalizar: sin espacios y en mayúscula (el usuario puede escribirlo en grupos de 4)
  SET p_iban = UPPER(REPLACE(TRIM(p_iban), ' ', ''));
  SET p_estado = UPPER(COALESCE(NULLIF(TRIM(p_estado), ''), 'ACTIVA'));
  SET p_fecha_apertura = COALESCE(p_fecha_apertura, CURDATE());

  START TRANSACTION;

  -- titular
  SELECT id_cliente, estado INTO v_id_cliente, v_estado_cli
    FROM cliente WHERE identificacion = p_identificacion;
  IF v_id_cliente IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El titular indicado no existe.';
  END IF;
  IF v_estado_cli <> 'ACTIVO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden abrir cuentas a un cliente inactivo.';
  END IF;

  -- entidad y moneda (catálogos)
  SELECT id_entidad INTO v_id_entidad FROM entidad_financiera WHERE codigo = p_codigo_entidad;
  IF v_id_entidad IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La entidad financiera no está en el catálogo.';
  END IF;
  SELECT id_moneda INTO v_id_moneda FROM moneda WHERE codigo = UPPER(p_codigo_moneda);
  IF v_id_moneda IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La moneda no está en el catálogo (CRC o USD).';
  END IF;

  -- IBAN ficticio: 22 caracteres, CR + 20 dígitos, único
  IF p_iban IS NULL OR CHAR_LENGTH(p_iban) <> 22 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El IBAN debe tener exactamente 22 caracteres.';
  END IF;
  IF p_iban NOT REGEXP '^CR[0-9]{20}$' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El IBAN debe iniciar con CR seguido de 20 dígitos.';
  END IF;
  IF EXISTS (SELECT 1 FROM cuenta WHERE iban = p_iban) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ya existe una cuenta con ese IBAN.';
  END IF;

  -- saldo, fecha y estado
  IF p_saldo_inicial IS NULL OR p_saldo_inicial < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El saldo inicial no puede ser negativo.';
  END IF;
  IF p_fecha_apertura > CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La fecha de apertura no puede ser futura.';
  END IF;
  IF p_estado NOT IN ('ACTIVA', 'INACTIVA', 'BLOQUEADA') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El estado debe ser ACTIVA, INACTIVA o BLOQUEADA.';
  END IF;

  INSERT INTO cuenta (iban, id_cliente, id_entidad, id_moneda, saldo, fecha_apertura, estado)
  VALUES (p_iban, v_id_cliente, v_id_entidad, v_id_moneda, p_saldo_inicial, p_fecha_apertura, p_estado);
  SET p_id_cuenta = LAST_INSERT_ID();

  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- sp_registrar_telefono · Registrar un teléfono para un titular sin duplicados
--   Registrar NO afilia (regla 3).
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_registrar_telefono$$
CREATE PROCEDURE sp_registrar_telefono(
  IN  p_numero          VARCHAR(20),
  IN  p_identificacion  VARCHAR(20),
  OUT p_id_telefono     INT UNSIGNED)
BEGIN
  DECLARE v_id_cliente INT UNSIGNED;
  DECLARE v_estado_cli VARCHAR(10);
  DECLARE v_msg        VARCHAR(128);

  -- se aceptan "8888-1111" u "8888 1111"; se guarda solo el número
  SET p_numero = REPLACE(REPLACE(TRIM(p_numero), '-', ''), ' ', '');

  IF p_numero IS NULL OR p_numero NOT REGEXP '^[0-9]{8}$' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El número celular debe tener exactamente 8 dígitos.';
  END IF;

  SELECT id_cliente, estado INTO v_id_cliente, v_estado_cli
    FROM cliente WHERE identificacion = p_identificacion;
  IF v_id_cliente IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El titular indicado no existe.';
  END IF;
  IF v_estado_cli <> 'ACTIVO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden registrar teléfonos a un cliente inactivo.';
  END IF;

  IF EXISTS (SELECT 1 FROM telefono WHERE numero = p_numero) THEN
    SET v_msg = CONCAT('El número ', p_numero, ' ya está registrado.');
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
  END IF;

  INSERT INTO telefono (numero, id_cliente) VALUES (p_numero, v_id_cliente);
  SET p_id_telefono = LAST_INSERT_ID();
END$$

-- ---------------------------------------------------------------------
-- sp_afiliar_sinpe · Validar titularidad, CRC, estado y afiliación única
--   Las mismas reglas las vuelve a comprobar trg_afiliacion_validar_bi;
--   aquí se validan primero para dar un mensaje preciso al usuario.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_afiliar_sinpe$$
CREATE PROCEDURE sp_afiliar_sinpe(
  IN p_numero CHAR(8),
  IN p_iban   VARCHAR(40))
BEGIN
  DECLARE v_id_tel      INT UNSIGNED;
  DECLARE v_tit_tel     INT UNSIGNED;
  DECLARE v_id_cta      INT UNSIGNED;
  DECLARE v_tit_cta     INT UNSIGNED;
  DECLARE v_estado      VARCHAR(10);
  DECLARE v_moneda      CHAR(3);
  DECLARE v_iban_actual CHAR(22);
  DECLARE v_msg         VARCHAR(128);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET @motivo_evento = NULL;
    RESIGNAL;
  END;

  SET p_iban = UPPER(REPLACE(TRIM(p_iban), ' ', ''));

  START TRANSACTION;

  -- bloquear el teléfono: dos afiliaciones simultáneas del mismo número se serializan
  SELECT id_telefono, id_cliente INTO v_id_tel, v_tit_tel
    FROM telefono WHERE numero = p_numero FOR UPDATE;
  IF v_id_tel IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono no está registrado.';
  END IF;

  SELECT c.iban INTO v_iban_actual
    FROM afiliacion_sinpe a JOIN cuenta c ON c.id_cuenta = a.id_cuenta
   WHERE a.id_telefono = v_id_tel;
  IF v_iban_actual IS NOT NULL THEN
    SET v_msg = CONCAT('El teléfono ya está afiliado a la cuenta ', v_iban_actual, '.');
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
  END IF;

  SELECT c.id_cuenta, c.id_cliente, c.estado, m.codigo
    INTO v_id_cta, v_tit_cta, v_estado, v_moneda
    FROM cuenta c JOIN moneda m ON m.id_moneda = c.id_moneda
   WHERE c.iban = p_iban FOR SHARE;
  IF v_id_cta IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta indicada no existe.';
  END IF;
  IF v_tit_cta <> v_tit_tel THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono y la cuenta deben pertenecer al mismo cliente.';
  END IF;
  IF v_estado <> 'ACTIVA' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se puede afiliar a una cuenta ACTIVA.';
  END IF;
  IF v_moneda <> 'CRC' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se puede afiliar a una cuenta en colones (CRC).';
  END IF;

  SET @motivo_evento = 'Afiliación';
  INSERT INTO afiliacion_sinpe (id_telefono, id_cuenta) VALUES (v_id_tel, v_id_cta);
  SET @motivo_evento = NULL;

  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- sp_desafiliar_sinpe · Eliminar afiliación vigente y conservar auditoría
--   El teléfono sigue registrado; trg_afiliacion_auditar_bd deja el evento.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_desafiliar_sinpe$$
CREATE PROCEDURE sp_desafiliar_sinpe(IN p_numero CHAR(8))
BEGIN
  DECLARE v_id_tel INT UNSIGNED;
  DECLARE v_id_af  INT UNSIGNED;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET @motivo_evento = NULL;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT id_telefono INTO v_id_tel FROM telefono WHERE numero = p_numero FOR UPDATE;
  IF v_id_tel IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono no está registrado.';
  END IF;

  SELECT id_afiliacion INTO v_id_af FROM afiliacion_sinpe WHERE id_telefono = v_id_tel FOR UPDATE;
  IF v_id_af IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono no tiene una afiliación vigente.';
  END IF;

  SET @motivo_evento = 'Desafiliación';
  DELETE FROM afiliacion_sinpe WHERE id_afiliacion = v_id_af;
  SET @motivo_evento = NULL;

  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- sp_cambiar_cuenta_sinpe · Trasladar afiliación con transacción y recuperación
--   Paso 1: desafiliar de la cuenta actual   (trigger → DESAFILIACION)
--   Paso 2: afiliar a la nueva cuenta        (trigger valida → AFILIACION)
--   Si el paso 2 falla (cuenta inactiva, en USD, de otro titular...) el
--   handler hace ROLLBACK: la afiliación original y su historial vuelven
--   a quedar exactamente como estaban.
--   La nueva cuenta se valida a propósito SOLO en el trigger del paso 2,
--   para que la recuperación sea observable.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_cambiar_cuenta_sinpe$$
CREATE PROCEDURE sp_cambiar_cuenta_sinpe(
  IN p_numero     CHAR(8),
  IN p_iban_nueva VARCHAR(40))
BEGIN
  DECLARE v_id_tel     INT UNSIGNED;
  DECLARE v_id_af      INT UNSIGNED;
  DECLARE v_cta_actual INT UNSIGNED;
  DECLARE v_cta_nueva  INT UNSIGNED;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;                -- recupera la afiliación original
    SET @motivo_evento = NULL;
    RESIGNAL;
  END;

  SET p_iban_nueva = UPPER(REPLACE(TRIM(p_iban_nueva), ' ', ''));

  START TRANSACTION;

  SELECT id_telefono INTO v_id_tel FROM telefono WHERE numero = p_numero FOR UPDATE;
  IF v_id_tel IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono no está registrado.';
  END IF;

  SELECT id_afiliacion, id_cuenta INTO v_id_af, v_cta_actual
    FROM afiliacion_sinpe WHERE id_telefono = v_id_tel FOR UPDATE;
  IF v_id_af IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono no tiene afiliación vigente para trasladar.';
  END IF;

  SELECT id_cuenta INTO v_cta_nueva FROM cuenta WHERE iban = p_iban_nueva;
  IF v_cta_nueva IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta de destino no existe.';
  END IF;
  IF v_cta_nueva = v_cta_actual THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono ya está afiliado a esa cuenta.';
  END IF;

  SET @motivo_evento = 'Traslado';
  -- paso 1
  DELETE FROM afiliacion_sinpe WHERE id_afiliacion = v_id_af;
  -- paso 2 (si falla, el EXIT HANDLER revierte también el paso 1)
  INSERT INTO afiliacion_sinpe (id_telefono, id_cuenta) VALUES (v_id_tel, v_cta_nueva);
  SET @motivo_evento = NULL;

  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- sp_transferir_sinpe · Transferir por teléfonos con bloqueos, validación y registro
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_transferir_sinpe$$
CREATE PROCEDURE sp_transferir_sinpe(
  IN  p_tel_origen   CHAR(8),
  IN  p_tel_destino  CHAR(8),
  IN  p_monto        DECIMAL(18,2),
  IN  p_detalle      VARCHAR(140),
  OUT p_id_transf    BIGINT UNSIGNED)
BEGIN
  DECLARE v_tel_o, v_tel_d       INT UNSIGNED;
  DECLARE v_tit_tel_o, v_tit_tel_d INT UNSIGNED;
  DECLARE v_cta_o, v_cta_d       INT UNSIGNED;
  DECLARE v_tit_cta_o, v_tit_cta_d INT UNSIGNED;
  DECLARE v_est_o, v_est_d       VARCHAR(10);
  DECLARE v_mon_o, v_mon_d       CHAR(3);
  DECLARE v_saldo_o, v_saldo_d   DECIMAL(18,2);
  DECLARE v_lock                 INT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El monto debe ser mayor que cero.';
  END IF;
  IF p_tel_origen = p_tel_destino THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono de origen y el de destino son el mismo.';
  END IF;

  START TRANSACTION;

  -- 1. Resolver teléfono → afiliación vigente → cuenta.
  --    FOR SHARE bloquea la afiliación: nadie la puede desafiliar o
  --    trasladar mientras esta transferencia esté en curso.
  SELECT t.id_telefono, t.id_cliente, a.id_cuenta
    INTO v_tel_o, v_tit_tel_o, v_cta_o
    FROM telefono t LEFT JOIN afiliacion_sinpe a ON a.id_telefono = t.id_telefono
   WHERE t.numero = p_tel_origen FOR SHARE;
  IF v_tel_o IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono de origen no está registrado.';
  END IF;
  IF v_cta_o IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono de origen no está afiliado a SINPE Móvil.';
  END IF;

  SELECT t.id_telefono, t.id_cliente, a.id_cuenta
    INTO v_tel_d, v_tit_tel_d, v_cta_d
    FROM telefono t LEFT JOIN afiliacion_sinpe a ON a.id_telefono = t.id_telefono
   WHERE t.numero = p_tel_destino FOR SHARE;
  IF v_tel_d IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono de destino no está registrado.';
  END IF;
  IF v_cta_d IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono de destino no está afiliado a SINPE Móvil.';
  END IF;

  -- 2. Regla 7: no entre teléfonos afiliados a la misma cuenta.
  IF v_cta_o = v_cta_d THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los dos teléfonos están afiliados a la misma cuenta: no se puede transferir.';
  END IF;

  -- 3. Bloquear las dos cuentas SIEMPRE en el mismo orden (id menor primero)
  --    para que dos transferencias cruzadas no produzcan un interbloqueo.
  SELECT 1 INTO v_lock FROM cuenta WHERE id_cuenta = LEAST(v_cta_o, v_cta_d)    FOR UPDATE;
  SELECT 1 INTO v_lock FROM cuenta WHERE id_cuenta = GREATEST(v_cta_o, v_cta_d) FOR UPDATE;

  SELECT c.id_cliente, c.estado, m.codigo, c.saldo INTO v_tit_cta_o, v_est_o, v_mon_o, v_saldo_o
    FROM cuenta c JOIN moneda m ON m.id_moneda = c.id_moneda WHERE c.id_cuenta = v_cta_o;
  SELECT c.id_cliente, c.estado, m.codigo, c.saldo INTO v_tit_cta_d, v_est_d, v_mon_d, v_saldo_d
    FROM cuenta c JOIN moneda m ON m.id_moneda = c.id_moneda WHERE c.id_cuenta = v_cta_d;

  -- 4. Titularidad, vigencia, moneda y saldo
  IF v_tit_cta_o <> v_tit_tel_o OR v_tit_cta_d <> v_tit_tel_d THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La titularidad del teléfono no coincide con la de su cuenta afiliada.';
  END IF;
  IF v_est_o <> 'ACTIVA' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta de origen no está activa.';
  END IF;
  IF v_est_d <> 'ACTIVA' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta de destino no está activa.';
  END IF;
  IF v_mon_o <> 'CRC' OR v_mon_d <> 'CRC' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SINPE Móvil solo opera con cuentas en colones (CRC).';
  END IF;
  IF v_saldo_o < p_monto THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Saldo insuficiente en la cuenta de origen.';
  END IF;

  -- 5. Debitar, acreditar y registrar (todo o nada)
  UPDATE cuenta SET saldo = saldo - p_monto WHERE id_cuenta = v_cta_o;
  UPDATE cuenta SET saldo = saldo + p_monto WHERE id_cuenta = v_cta_d;

  INSERT INTO transferencia (tipo, id_cuenta_origen, id_cuenta_destino, id_telefono_origen, id_telefono_destino,
                             monto, detalle, saldo_origen_despues, saldo_destino_despues)
  VALUES ('SINPE', v_cta_o, v_cta_d, v_tel_o, v_tel_d,
          p_monto, NULLIF(TRIM(p_detalle), ''), v_saldo_o - p_monto, v_saldo_d + p_monto);
  SET p_id_transf = LAST_INSERT_ID();

  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- sp_transferir_iban · Transferir por IBAN con control transaccional
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_transferir_iban$$
CREATE PROCEDURE sp_transferir_iban(
  IN  p_iban_origen  VARCHAR(40),
  IN  p_iban_destino VARCHAR(40),
  IN  p_monto        DECIMAL(18,2),
  IN  p_detalle      VARCHAR(140),
  OUT p_id_transf    BIGINT UNSIGNED)
BEGIN
  DECLARE v_cta_o, v_cta_d       INT UNSIGNED;
  DECLARE v_est_o, v_est_d       VARCHAR(10);
  DECLARE v_mon_o, v_mon_d       TINYINT UNSIGNED;
  DECLARE v_saldo_o, v_saldo_d   DECIMAL(18,2);
  DECLARE v_lock                 INT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET p_iban_origen  = UPPER(REPLACE(TRIM(p_iban_origen), ' ', ''));
  SET p_iban_destino = UPPER(REPLACE(TRIM(p_iban_destino), ' ', ''));

  IF p_monto IS NULL OR p_monto <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El monto debe ser mayor que cero.';
  END IF;
  IF p_iban_origen = p_iban_destino THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una cuenta no puede transferirse a sí misma.';
  END IF;

  START TRANSACTION;

  SELECT id_cuenta INTO v_cta_o FROM cuenta WHERE iban = p_iban_origen;
  IF v_cta_o IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta de origen no existe.';
  END IF;
  SELECT id_cuenta INTO v_cta_d FROM cuenta WHERE iban = p_iban_destino;
  IF v_cta_d IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta de destino no existe.';
  END IF;

  -- bloqueo en orden fijo (evita interbloqueos)
  SELECT 1 INTO v_lock FROM cuenta WHERE id_cuenta = LEAST(v_cta_o, v_cta_d)    FOR UPDATE;
  SELECT 1 INTO v_lock FROM cuenta WHERE id_cuenta = GREATEST(v_cta_o, v_cta_d) FOR UPDATE;

  SELECT estado, id_moneda, saldo INTO v_est_o, v_mon_o, v_saldo_o FROM cuenta WHERE id_cuenta = v_cta_o;
  SELECT estado, id_moneda, saldo INTO v_est_d, v_mon_d, v_saldo_d FROM cuenta WHERE id_cuenta = v_cta_d;

  IF v_est_o <> 'ACTIVA' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta de origen no está activa.';
  END IF;
  IF v_est_d <> 'ACTIVA' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta de destino no está activa.';
  END IF;
  IF v_mon_o <> v_mon_d THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las dos cuentas deben tener la misma moneda.';
  END IF;
  IF v_saldo_o < p_monto THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Saldo insuficiente en la cuenta de origen.';
  END IF;

  UPDATE cuenta SET saldo = saldo - p_monto WHERE id_cuenta = v_cta_o;
  UPDATE cuenta SET saldo = saldo + p_monto WHERE id_cuenta = v_cta_d;

  INSERT INTO transferencia (tipo, id_cuenta_origen, id_cuenta_destino, monto, detalle,
                             saldo_origen_despues, saldo_destino_despues)
  VALUES ('IBAN', v_cta_o, v_cta_d, p_monto, NULLIF(TRIM(p_detalle), ''),
          v_saldo_o - p_monto, v_saldo_d + p_monto);
  SET p_id_transf = LAST_INSERT_ID();

  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- sp_consultar_movimientos · Movimientos de una cuenta en un período
--   (también responde el informe 5.4: enviadas y recibidas, fecha y monto)
--   p_hasta es inclusivo: se toma el día completo.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_consultar_movimientos$$
CREATE PROCEDURE sp_consultar_movimientos(
  IN p_iban  VARCHAR(40),
  IN p_desde DATE,
  IN p_hasta DATE)
BEGIN
  DECLARE v_cta INT UNSIGNED;

  SET p_iban = UPPER(REPLACE(TRIM(p_iban), ' ', ''));
  SELECT id_cuenta INTO v_cta FROM cuenta WHERE iban = p_iban;
  IF v_cta IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta indicada no existe.';
  END IF;
  IF p_desde IS NULL OR p_hasta IS NULL OR p_desde > p_hasta THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El período no es válido: la fecha inicial debe ser anterior a la final.';
  END IF;

  SELECT t.id_transferencia,
         CONCAT('TRF-', LPAD(t.id_transferencia, 6, '0'))            AS comprobante,
         t.fecha,
         t.tipo,
         IF(t.id_cuenta_origen = v_cta, 'ENVIADA', 'RECIBIDA')         AS direccion,
         cp.iban                                                       AS iban_contraparte,
         cl.nombre_completo                                            AS titular_contraparte,
         IF(t.id_cuenta_origen = v_cta, td.numero, tor.numero)         AS telefono_contraparte,
         IF(t.id_cuenta_origen = v_cta, tor.numero, td.numero)         AS telefono_propio,
         t.detalle,
         t.monto,
         IF(t.id_cuenta_origen = v_cta, t.monto, 0)                    AS enviado,
         IF(t.id_cuenta_destino = v_cta, t.monto, 0)                   AS recibido,
         IF(t.id_cuenta_origen = v_cta, t.saldo_origen_despues, t.saldo_destino_despues) AS saldo_despues
    FROM transferencia t
    JOIN cuenta  cp ON cp.id_cuenta = IF(t.id_cuenta_origen = v_cta, t.id_cuenta_destino, t.id_cuenta_origen)
    JOIN cliente cl ON cl.id_cliente = cp.id_cliente
    LEFT JOIN telefono tor ON tor.id_telefono = t.id_telefono_origen
    LEFT JOIN telefono td  ON td.id_telefono  = t.id_telefono_destino
   WHERE (t.id_cuenta_origen = v_cta OR t.id_cuenta_destino = v_cta)
     AND t.fecha >= p_desde
     AND t.fecha <  p_hasta + INTERVAL 1 DAY
   ORDER BY t.fecha, t.id_transferencia;
END$$

-- =====================================================================
--  Procedimientos controlados adicionales (regla 10)
-- =====================================================================

-- Cambiar el titular de un teléfono sin dejar afiliaciones inválidas:
-- si está afiliado, se desafilia (queda en el historial) y luego se cambia
-- el titular, todo en una sola transacción.
DROP PROCEDURE IF EXISTS sp_cambiar_titular_telefono$$
CREATE PROCEDURE sp_cambiar_titular_telefono(
  IN p_numero         CHAR(8),
  IN p_identificacion VARCHAR(20))
BEGIN
  DECLARE v_id_tel     INT UNSIGNED;
  DECLARE v_tit_actual INT UNSIGNED;
  DECLARE v_tit_nuevo  INT UNSIGNED;
  DECLARE v_estado     VARCHAR(10);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET @motivo_evento = NULL;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT id_telefono, id_cliente INTO v_id_tel, v_tit_actual
    FROM telefono WHERE numero = p_numero FOR UPDATE;
  IF v_id_tel IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono no está registrado.';
  END IF;

  SELECT id_cliente, estado INTO v_tit_nuevo, v_estado FROM cliente WHERE identificacion = p_identificacion;
  IF v_tit_nuevo IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El nuevo titular no existe.';
  END IF;
  IF v_estado <> 'ACTIVO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El nuevo titular está inactivo.';
  END IF;
  IF v_tit_nuevo = v_tit_actual THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono ya pertenece a ese cliente.';
  END IF;

  SET @motivo_evento = 'Cambio de titular';
  DELETE FROM afiliacion_sinpe WHERE id_telefono = v_id_tel;   -- 0 o 1 fila
  SET @motivo_evento = NULL;

  UPDATE telefono SET id_cliente = v_tit_nuevo WHERE id_telefono = v_id_tel;

  COMMIT;
END$$

-- Cambiar el estado de una cuenta. Si deja de estar ACTIVA y tiene teléfonos
-- afiliados: se rechaza, salvo que p_desafiliar = TRUE, en cuyo caso se
-- desafilian (con historial) en la misma transacción.
DROP PROCEDURE IF EXISTS sp_cambiar_estado_cuenta$$
CREATE PROCEDURE sp_cambiar_estado_cuenta(
  IN p_iban       VARCHAR(40),
  IN p_estado     VARCHAR(10),
  IN p_desafiliar BOOLEAN)
BEGIN
  DECLARE v_cta    INT UNSIGNED;
  DECLARE v_actual VARCHAR(10);
  DECLARE v_af     INT;
  DECLARE v_msg    VARCHAR(128);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET @motivo_evento = NULL;
    RESIGNAL;
  END;

  SET p_iban = UPPER(REPLACE(TRIM(p_iban), ' ', ''));
  SET p_estado = UPPER(TRIM(p_estado));

  IF p_estado NOT IN ('ACTIVA', 'INACTIVA', 'BLOQUEADA') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El estado debe ser ACTIVA, INACTIVA o BLOQUEADA.';
  END IF;

  START TRANSACTION;

  SELECT id_cuenta, estado INTO v_cta, v_actual FROM cuenta WHERE iban = p_iban FOR UPDATE;
  IF v_cta IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta indicada no existe.';
  END IF;
  IF v_actual = p_estado THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta ya tiene ese estado.';
  END IF;

  SELECT COUNT(*) INTO v_af FROM afiliacion_sinpe WHERE id_cuenta = v_cta FOR UPDATE;
  IF p_estado <> 'ACTIVA' AND v_af > 0 THEN
    IF NOT COALESCE(p_desafiliar, FALSE) THEN
      SET v_msg = CONCAT('La cuenta tiene ', v_af, ' teléfono(s) afiliado(s). Desafílielos o confirme la desafiliación.');
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
    END IF;
    SET @motivo_evento = CONCAT('Cuenta ', LOWER(p_estado));
    DELETE FROM afiliacion_sinpe WHERE id_cuenta = v_cta;
    SET @motivo_evento = NULL;
  END IF;

  UPDATE cuenta SET estado = p_estado WHERE id_cuenta = v_cta;

  COMMIT;
END$$

DELIMITER ;
