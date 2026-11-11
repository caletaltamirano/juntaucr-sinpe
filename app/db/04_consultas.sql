-- =====================================================================
--  JUNTAUCR · SINPE Móvil
--  04 · Vistas y consultas e informes (sección 5)
-- =====================================================================
USE juntaucr_sinpe;

-- ---------------------------------------------------------------------
-- Vistas de apoyo (las usa la aplicación web)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_cuentas AS
SELECT c.id_cuenta, c.iban, c.saldo, c.fecha_apertura, c.estado,
       cl.id_cliente, cl.identificacion, cl.nombre_completo AS titular,
       e.codigo AS codigo_entidad, e.nombre AS entidad,
       m.codigo AS moneda, m.simbolo,
       (SELECT COUNT(*) FROM afiliacion_sinpe a WHERE a.id_cuenta = c.id_cuenta) AS telefonos_afiliados,
       cl.estado AS estado_cliente
  FROM cuenta c
  JOIN cliente cl           ON cl.id_cliente = c.id_cliente
  JOIN entidad_financiera e ON e.id_entidad  = c.id_entidad
  JOIN moneda m             ON m.id_moneda   = c.id_moneda;

CREATE OR REPLACE VIEW v_transferencias AS
SELECT t.id_transferencia,
       CONCAT('TRF-', LPAD(t.id_transferencia, 6, '0')) AS comprobante,
       t.tipo, t.fecha, t.monto, t.detalle,
       co.iban AS iban_origen,  clo.nombre_completo AS titular_origen,  tor.numero AS telefono_origen,
       cd.iban AS iban_destino, cld.nombre_completo AS titular_destino, tde.numero AS telefono_destino,
       m.codigo AS moneda,
       t.saldo_origen_despues, t.saldo_destino_despues
  FROM transferencia t
  JOIN cuenta  co  ON co.id_cuenta   = t.id_cuenta_origen
  JOIN cuenta  cd  ON cd.id_cuenta   = t.id_cuenta_destino
  JOIN cliente clo ON clo.id_cliente = co.id_cliente
  JOIN cliente cld ON cld.id_cliente = cd.id_cliente
  JOIN moneda  m   ON m.id_moneda    = co.id_moneda
  LEFT JOIN telefono tor ON tor.id_telefono = t.id_telefono_origen
  LEFT JOIN telefono tde ON tde.id_telefono = t.id_telefono_destino;

-- ---------------------------------------------------------------------
-- 5.1 Teléfonos de cada cliente, indicando cuáles están afiliados
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_telefonos_cliente AS
SELECT cl.id_cliente, cl.identificacion, cl.nombre_completo AS titular, cl.estado AS estado_cliente,
       t.id_telefono, t.numero, t.fecha_registro,
       IF(a.id_afiliacion IS NULL, 'NO', 'SI') AS afiliado,
       c.iban  AS iban_afiliado,
       a.fecha_afiliacion,
       c.id_entidad AS id_entidad_afiliada
  FROM telefono t
  JOIN cliente cl ON cl.id_cliente = t.id_cliente
  LEFT JOIN afiliacion_sinpe a ON a.id_telefono = t.id_telefono
  LEFT JOIN cuenta c           ON c.id_cuenta   = a.id_cuenta;

DELIMITER $$

-- ---------------------------------------------------------------------
-- 5.2 Teléfonos asociados a una cuenta IBAN
--     Vigentes y los que estuvieron afiliados antes (desde el historial).
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_telefonos_por_cuenta$$
CREATE PROCEDURE sp_telefonos_por_cuenta(IN p_iban VARCHAR(40))
BEGIN
  DECLARE v_cta INT UNSIGNED;
  SET p_iban = UPPER(REPLACE(TRIM(p_iban), ' ', ''));
  SELECT id_cuenta INTO v_cta FROM cuenta WHERE iban = p_iban;
  IF v_cta IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta indicada no existe.';
  END IF;

  SELECT t.numero,
         cl.nombre_completo AS titular,
         IF(a.id_afiliacion IS NULL, 'ANTERIOR', 'VIGENTE') AS situacion,
         a.fecha_afiliacion AS afiliado_desde,
         (SELECT MAX(h.fecha_evento) FROM historial_afiliacion h
           WHERE h.id_telefono = t.id_telefono AND h.id_cuenta = v_cta) AS ultimo_evento
    FROM telefono t
    JOIN cliente cl ON cl.id_cliente = t.id_cliente
    LEFT JOIN afiliacion_sinpe a ON a.id_telefono = t.id_telefono AND a.id_cuenta = v_cta
   WHERE a.id_afiliacion IS NOT NULL
      OR EXISTS (SELECT 1 FROM historial_afiliacion h WHERE h.id_telefono = t.id_telefono AND h.id_cuenta = v_cta)
   ORDER BY situacion DESC, t.numero;
END$$

-- ---------------------------------------------------------------------
-- 5.3 Historial cronológico de afiliaciones y desafiliaciones de un teléfono
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_historial_telefono$$
CREATE PROCEDURE sp_historial_telefono(IN p_numero VARCHAR(20))
BEGIN
  DECLARE v_tel INT UNSIGNED;
  SET p_numero = REPLACE(REPLACE(TRIM(p_numero), '-', ''), ' ', '');
  SELECT id_telefono INTO v_tel FROM telefono WHERE numero = p_numero;
  IF v_tel IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono no está registrado.';
  END IF;

  SELECT h.id_historial, h.fecha_evento, h.tipo_evento, c.iban, e.nombre AS entidad, h.motivo
    FROM historial_afiliacion h
    JOIN cuenta c             ON c.id_cuenta  = h.id_cuenta
    JOIN entidad_financiera e ON e.id_entidad = c.id_entidad
   WHERE h.id_telefono = v_tel
   ORDER BY h.fecha_evento, h.id_historial;
END$$

-- 5.4 → sp_consultar_movimientos (03_procedimientos.sql)

-- ---------------------------------------------------------------------
-- 5.5 Total enviado y recibido por una cuenta en un intervalo de fechas
--     Incluye el saldo al inicio y al final del intervalo, reconstruido a
--     partir del saldo actual y las transferencias registradas.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_totales_periodo$$
CREATE PROCEDURE sp_totales_periodo(
  IN p_iban  VARCHAR(40),
  IN p_desde DATE,
  IN p_hasta DATE)
BEGIN
  DECLARE v_cta   INT UNSIGNED;
  DECLARE v_saldo DECIMAL(18,2);
  SET p_iban = UPPER(REPLACE(TRIM(p_iban), ' ', ''));
  SELECT id_cuenta, saldo INTO v_cta, v_saldo FROM cuenta WHERE iban = p_iban;
  IF v_cta IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta indicada no existe.';
  END IF;
  IF p_desde IS NULL OR p_hasta IS NULL OR p_desde > p_hasta THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El período no es válido: la fecha inicial debe ser anterior a la final.';
  END IF;

  SELECT p_iban AS iban, p_desde AS desde, p_hasta AS hasta,
         COALESCE(SUM(IF(t.id_cuenta_origen  = v_cta AND en_rango, t.monto, 0)), 0) AS total_enviado,
         COALESCE(SUM(IF(t.id_cuenta_destino = v_cta AND en_rango, t.monto, 0)), 0) AS total_recibido,
         COALESCE(SUM(t.id_cuenta_origen  = v_cta AND en_rango), 0) AS cantidad_enviadas,
         COALESCE(SUM(t.id_cuenta_destino = v_cta AND en_rango), 0) AS cantidad_recibidas,
         -- saldo en una fecha = saldo actual − efecto neto de todo lo ocurrido desde esa fecha
         v_saldo - COALESCE(SUM(IF(t.fecha >= p_desde, IF(t.id_cuenta_destino = v_cta, t.monto, -t.monto), 0)), 0) AS saldo_inicial,
         v_saldo - COALESCE(SUM(IF(t.fecha >= p_hasta + INTERVAL 1 DAY, IF(t.id_cuenta_destino = v_cta, t.monto, -t.monto), 0)), 0) AS saldo_final
    FROM (SELECT x.*, (x.fecha >= p_desde AND x.fecha < p_hasta + INTERVAL 1 DAY) AS en_rango
            FROM transferencia x
           WHERE x.id_cuenta_origen = v_cta OR x.id_cuenta_destino = v_cta) t;
END$$

-- ---------------------------------------------------------------------
-- 5.6 Saldos de las cuentas participantes y conservación del total
--     Los saldos NO se reconstruyen desde el saldo actual (eso cuadraría
--     siempre, por construcción). Se toman de la evidencia que cada
--     transferencia guardó (saldo_origen_despues / saldo_destino_despues):
--       saldo_inicial    = saldo antes de la primera transferencia del período
--       saldo_final      = saldo después de la última transferencia del período
--       saldo_registrado = saldo actual de la cuenta menos lo movido después
--                          del período (lo que dice la tabla cuenta hoy)
--     CUADRA si inicial − enviado + recibido = final  (la evidencia es coherente)
--            y final = registrado                     (nadie tocó el saldo fuera
--                                                      de una transferencia).
--     Resultado 1: por cuenta. Resultado 2: por moneda; SE CONSERVA si la suma
--     inicial es igual a la final y todas las cuentas cuadran.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_comprobar_conservacion$$
CREATE PROCEDURE sp_comprobar_conservacion(
  IN p_desde DATE,
  IN p_hasta DATE)
BEGIN
  IF p_desde IS NULL OR p_hasta IS NULL OR p_desde > p_hasta THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El período no es válido: la fecha inicial debe ser anterior a la final.';
  END IF;

  DROP TEMPORARY TABLE IF EXISTS tmp_conservacion;
  CREATE TEMPORARY TABLE tmp_conservacion AS
  SELECT c.id_cuenta, c.iban, cl.nombre_completo AS titular, m.codigo AS moneda,
         (SELECT IF(t.id_cuenta_destino = c.id_cuenta, t.saldo_destino_despues - t.monto, t.saldo_origen_despues + t.monto)
            FROM transferencia t
           WHERE (t.id_cuenta_origen = c.id_cuenta OR t.id_cuenta_destino = c.id_cuenta)
             AND t.fecha >= p_desde AND t.fecha < p_hasta + INTERVAL 1 DAY
           ORDER BY t.fecha, t.id_transferencia LIMIT 1) AS saldo_inicial,
         COALESCE((SELECT SUM(t.monto) FROM transferencia t
                    WHERE t.id_cuenta_origen = c.id_cuenta
                      AND t.fecha >= p_desde AND t.fecha < p_hasta + INTERVAL 1 DAY), 0) AS enviado,
         COALESCE((SELECT SUM(t.monto) FROM transferencia t
                    WHERE t.id_cuenta_destino = c.id_cuenta
                      AND t.fecha >= p_desde AND t.fecha < p_hasta + INTERVAL 1 DAY), 0) AS recibido,
         (SELECT IF(t.id_cuenta_destino = c.id_cuenta, t.saldo_destino_despues, t.saldo_origen_despues)
            FROM transferencia t
           WHERE (t.id_cuenta_origen = c.id_cuenta OR t.id_cuenta_destino = c.id_cuenta)
             AND t.fecha >= p_desde AND t.fecha < p_hasta + INTERVAL 1 DAY
           ORDER BY t.fecha DESC, t.id_transferencia DESC LIMIT 1) AS saldo_final,
         c.saldo
           - COALESCE((SELECT SUM(IF(t.id_cuenta_destino = c.id_cuenta, t.monto, -t.monto)) FROM transferencia t
                        WHERE (t.id_cuenta_origen = c.id_cuenta OR t.id_cuenta_destino = c.id_cuenta)
                          AND t.fecha >= p_hasta + INTERVAL 1 DAY), 0) AS saldo_registrado
    FROM cuenta c
    JOIN cliente cl ON cl.id_cliente = c.id_cliente
    JOIN moneda m   ON m.id_moneda   = c.id_moneda
   WHERE EXISTS (SELECT 1 FROM transferencia t
                  WHERE (t.id_cuenta_origen = c.id_cuenta OR t.id_cuenta_destino = c.id_cuenta)
                    AND t.fecha >= p_desde AND t.fecha < p_hasta + INTERVAL 1 DAY);

  SELECT iban, titular, moneda, saldo_inicial, enviado, recibido, saldo_final, saldo_registrado,
         IF(saldo_inicial - enviado + recibido = saldo_final AND saldo_final = saldo_registrado,
            'CUADRA', 'NO CUADRA') AS verificacion
    FROM tmp_conservacion
   ORDER BY moneda, iban;

  SELECT moneda,
         COUNT(*)           AS cuentas,
         SUM(saldo_inicial) AS total_inicial,
         SUM(enviado)       AS total_enviado,
         SUM(recibido)      AS total_recibido,
         SUM(saldo_final)   AS total_final,
         SUM(saldo_registrado) AS total_registrado,
         IF(SUM(saldo_inicial) = SUM(saldo_final)
            AND SUM(saldo_inicial - enviado + recibido <> saldo_final OR saldo_final <> saldo_registrado) = 0,
            'SE CONSERVA', 'NO SE CONSERVA') AS conservacion
    FROM tmp_conservacion
   GROUP BY moneda;

  -- resumen en una variable de sesión, para poder afirmarlo en 06_pruebas.sql
  SELECT IF(COUNT(*) = 0 OR SUM(saldo_inicial - enviado + recibido <> saldo_final OR saldo_final <> saldo_registrado) = 0,
            'SE CONSERVA', 'NO SE CONSERVA')
    INTO @conservacion
    FROM tmp_conservacion;

  DROP TEMPORARY TABLE IF EXISTS tmp_conservacion;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------
-- Ejemplos de uso
-- ---------------------------------------------------------------------
-- SELECT * FROM v_telefonos_cliente ORDER BY titular, numero;              -- 5.1
-- CALL sp_telefonos_por_cuenta('CR21015200001234567890');                  -- 5.2
-- CALL sp_historial_telefono('88881111');                                  -- 5.3
-- CALL sp_consultar_movimientos('CR21015200001234567890', '2026-01-01', CURDATE()); -- 5.4
-- CALL sp_totales_periodo('CR21015200001234567890', '2026-01-01', CURDATE());       -- 5.5
-- CALL sp_comprobar_conservacion('2026-01-01', CURDATE());                 -- 5.6
