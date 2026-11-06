-- =====================================================================
--  JUNTAUCR · SINPE Móvil
--  05 · Datos ficticios del escenario de prueba
--  Todo se carga por medio de los procedimientos, así que los triggers
--  generan el historial igual que en la operación normal.
-- =====================================================================
USE juntaucr_sinpe;

-- Catálogos
INSERT INTO moneda (codigo, descripcion, simbolo) VALUES
  ('CRC', 'Colón costarricense', '₡'),
  ('USD', 'Dólar estadounidense', '$');

INSERT INTO entidad_financiera (codigo, nombre) VALUES
  ('0152', 'JUNTAUCR'),
  ('0814', 'Banco Volcán'),
  ('0901', 'Cooperativa Arenal'),
  ('0733', 'Financiera Poás');

-- Operador de la aplicación: admin@juntaucr.cr / juntaucr2026
INSERT INTO usuario (correo, nombre, sal, clave_hash) VALUES
  ('admin@juntaucr.cr', 'Admin Operaciones', 'a1b2c3d4e5f60718', SHA2(CONCAT('a1b2c3d4e5f60718', 'juntaucr2026'), 256));

-- Clientes
CALL sp_registrar_cliente('1-1234-0567', 'Ana Rodríguez Mora',     'ana.rodriguez@correo.cr', @c);
CALL sp_registrar_cliente('2-0456-0789', 'Carlos Jiménez Solís',   'cjimenez@correo.cr',      @c);
CALL sp_registrar_cliente('1-0987-0654', 'María Fernández Vargas', 'maria.fv@correo.cr',      @c);
CALL sp_registrar_cliente('3-0321-0111', 'José Ramírez Castro',    'jramirez@correo.cr',      @c);
CALL sp_registrar_cliente('1-1111-0222', 'Laura Chaves Quesada',   'laura.chaves@correo.cr',  @c);

-- Cuentas IBAN (saldos iniciales, antes de las transferencias del escenario)
CALL sp_registrar_cuenta('CR21015200001234567890', '1-1234-0567', '0152', 'CRC',  772500.00, '2026-03-15', 'ACTIVA',    @a);  -- "IBAN 001"
CALL sp_registrar_cuenta('CR54015200004445556667', '1-1234-0567', '0152', 'CRC',  120000.00, '2026-05-01', 'ACTIVA',    @a);
CALL sp_registrar_cuenta('CR47015200009876543210', '1-1234-0567', '0152', 'USD',    1250.00, '2026-03-15', 'ACTIVA',    @a);
CALL sp_registrar_cuenta('CR63081400005551112223', '2-0456-0789', '0814', 'CRC',  300500.00, '2026-03-21', 'ACTIVA',    @a);  -- "IBAN 002"
CALL sp_registrar_cuenta('CR88090100007778889990', '1-0987-0654', '0901', 'CRC', 1397500.00, '2026-04-03', 'ACTIVA',    @a);
CALL sp_registrar_cuenta('CR12015200003334445556', '3-0321-0111', '0152', 'CRC',   15000.00, '2026-05-19', 'INACTIVA',  @a);
CALL sp_registrar_cuenta('CR35081400002223334445', '1-1111-0222', '0814', 'CRC',   98300.00, '2026-07-08', 'BLOQUEADA', @a);

-- Teléfonos (registrados, todavía sin afiliar)
CALL sp_registrar_telefono('88881111', '1-1234-0567', @t);
CALL sp_registrar_telefono('88882222', '1-1234-0567', @t);
CALL sp_registrar_telefono('87776666', '1-1234-0567', @t);
CALL sp_registrar_telefono('88883333', '2-0456-0789', @t);
CALL sp_registrar_telefono('83334444', '1-0987-0654', @t);
CALL sp_registrar_telefono('60001234', '3-0321-0111', @t);
CALL sp_registrar_telefono('71112222', '1-1111-0222', @t);

-- José queda inactivo después de registrar sus datos
UPDATE cliente SET estado = 'INACTIVO' WHERE identificacion = '3-0321-0111';

-- Afiliaciones SINPE Móvil
CALL sp_afiliar_sinpe('88881111', 'CR21015200001234567890');
CALL sp_afiliar_sinpe('88882222', 'CR21015200001234567890');
CALL sp_afiliar_sinpe('88883333', 'CR63081400005551112223');
CALL sp_afiliar_sinpe('83334444', 'CR88090100007778889990');

-- Historial con traslados: 88881111 pasa a la otra cuenta de Ana y regresa
CALL sp_cambiar_cuenta_sinpe('88881111', 'CR54015200004445556667');
CALL sp_cambiar_cuenta_sinpe('88881111', 'CR21015200001234567890');

-- Transferencias del escenario
CALL sp_transferir_iban ('CR21015200001234567890', 'CR63081400005551112223', 107500, 'Factura octubre', @x);
CALL sp_transferir_sinpe('88883333', '83334444',  12500, 'Café',            @x);
CALL sp_transferir_sinpe('83334444', '88882222',  60000, 'Préstamo',        @x);
CALL sp_transferir_iban ('CR88090100007778889990', 'CR21015200001234567890', 150000, 'Pago servicios', @x);
CALL sp_transferir_sinpe('88881111', '88883333',  25000, 'Almuerzo',        @x);

-- Resultado esperado: Ana (IBAN 001) ₡850.000, Carlos ₡420.500, María ₡1.200.000
-- SELECT iban, titular, saldo FROM v_cuentas;
