-- =====================================================================
--  JUNTAUCR · SINPE Móvil (simulación)
--  01 · Esquema de la base de datos
--  Motor: MySQL 8.0 (InnoDB, utf8mb4)
-- =====================================================================

DROP DATABASE IF EXISTS juntaucr_sinpe;
CREATE DATABASE juntaucr_sinpe CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci;
USE juntaucr_sinpe;

-- ---------------------------------------------------------------------
-- 2.2 Catálogos: monedas y entidades financieras
--     Las cuentas solo guardan la llave foránea; los nombres no se repiten.
-- ---------------------------------------------------------------------
CREATE TABLE moneda (
  id_moneda    TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo       CHAR(3)      NOT NULL,
  descripcion  VARCHAR(60)  NOT NULL,
  simbolo      VARCHAR(4)   NOT NULL,
  CONSTRAINT uq_moneda_codigo      UNIQUE (codigo),
  CONSTRAINT uq_moneda_descripcion UNIQUE (descripcion),
  CONSTRAINT ck_moneda_codigo      CHECK (codigo REGEXP '^[A-Z]{3}$')
) ENGINE = InnoDB;

CREATE TABLE entidad_financiera (
  id_entidad  SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo      CHAR(4)      NOT NULL,
  nombre      VARCHAR(80)  NOT NULL,
  CONSTRAINT uq_entidad_codigo UNIQUE (codigo),
  CONSTRAINT uq_entidad_nombre UNIQUE (nombre),
  CONSTRAINT ck_entidad_codigo CHECK (codigo REGEXP '^[0-9]{4}$')
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 2.1 Clientes
-- ---------------------------------------------------------------------
CREATE TABLE cliente (
  id_cliente      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  identificacion  VARCHAR(20)   NOT NULL,
  nombre_completo VARCHAR(120)  NOT NULL,
  correo          VARCHAR(120)  NOT NULL,
  fecha_registro  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado          ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  CONSTRAINT uq_cliente_identificacion UNIQUE (identificacion),
  CONSTRAINT uq_cliente_correo         UNIQUE (correo),
  CONSTRAINT ck_cliente_correo         CHECK (correo LIKE '%_@_%._%')
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 2.3 Cuentas IBAN
--     IBAN ficticio de 22 caracteres: CR + 20 dígitos. Saldo nunca negativo.
-- ---------------------------------------------------------------------
CREATE TABLE cuenta (
  id_cuenta       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  iban            CHAR(22)          NOT NULL,
  id_cliente      INT UNSIGNED      NOT NULL,
  id_entidad      SMALLINT UNSIGNED NOT NULL,
  id_moneda       TINYINT UNSIGNED  NOT NULL,
  saldo           DECIMAL(18,2)     NOT NULL DEFAULT 0,
  fecha_apertura  DATE              NOT NULL,
  estado          ENUM('ACTIVA','INACTIVA','BLOQUEADA') NOT NULL DEFAULT 'ACTIVA',
  CONSTRAINT uq_cuenta_iban     UNIQUE (iban),
  CONSTRAINT ck_cuenta_iban     CHECK (CHAR_LENGTH(iban) = 22 AND iban REGEXP '^CR[0-9]{20}$'),
  CONSTRAINT ck_cuenta_saldo    CHECK (saldo >= 0),
  CONSTRAINT fk_cuenta_cliente  FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente),
  CONSTRAINT fk_cuenta_entidad  FOREIGN KEY (id_entidad) REFERENCES entidad_financiera (id_entidad),
  CONSTRAINT fk_cuenta_moneda   FOREIGN KEY (id_moneda)  REFERENCES moneda (id_moneda)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 2.4 Teléfonos (tabla independiente, FK al cliente titular)
--     Número único de exactamente 8 dígitos. Registrar ≠ afiliar.
-- ---------------------------------------------------------------------
CREATE TABLE telefono (
  id_telefono     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero          CHAR(8)       NOT NULL,
  id_cliente      INT UNSIGNED  NOT NULL,
  fecha_registro  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_telefono_numero  UNIQUE (numero),
  CONSTRAINT ck_telefono_numero  CHECK (numero REGEXP '^[0-9]{8}$'),
  CONSTRAINT fk_telefono_cliente FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 2.5 Afiliación SINPE Móvil vigente
--     UNIQUE(id_telefono) => cada teléfono tiene como máximo UNA afiliación
--     vigente. Desafiliar = borrar la fila (el historial la conserva).
--     Una cuenta puede tener varias filas (varios teléfonos del mismo titular).
-- ---------------------------------------------------------------------
CREATE TABLE afiliacion_sinpe (
  id_afiliacion    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_telefono      INT UNSIGNED NOT NULL,
  id_cuenta        INT UNSIGNED NOT NULL,
  fecha_afiliacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_afiliacion_telefono UNIQUE (id_telefono),
  CONSTRAINT fk_afiliacion_telefono FOREIGN KEY (id_telefono) REFERENCES telefono (id_telefono),
  CONSTRAINT fk_afiliacion_cuenta   FOREIGN KEY (id_cuenta)   REFERENCES cuenta (id_cuenta),
  INDEX ix_afiliacion_cuenta (id_cuenta)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 2.7 Historial de afiliaciones (solo lo escriben los triggers)
-- ---------------------------------------------------------------------
CREATE TABLE historial_afiliacion (
  id_historial  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_telefono   INT UNSIGNED NOT NULL,
  id_cuenta     INT UNSIGNED NOT NULL,
  tipo_evento   ENUM('AFILIACION','DESAFILIACION') NOT NULL,
  fecha_evento  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  motivo        VARCHAR(60)  NOT NULL DEFAULT 'Operación directa',
  CONSTRAINT fk_historial_telefono FOREIGN KEY (id_telefono) REFERENCES telefono (id_telefono),
  CONSTRAINT fk_historial_cuenta   FOREIGN KEY (id_cuenta)   REFERENCES cuenta (id_cuenta),
  INDEX ix_historial_telefono_fecha (id_telefono, fecha_evento)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 2.8 / 2.9 Transferencias (SINPE Móvil o IBAN)
--     Siempre se guardan las dos cuentas; los teléfonos solo si fue SINPE.
--     saldo_*_despues deja evidencia verificable del efecto de cada operación.
-- ---------------------------------------------------------------------
CREATE TABLE transferencia (
  id_transferencia      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tipo                  ENUM('SINPE','IBAN') NOT NULL,
  id_cuenta_origen      INT UNSIGNED  NOT NULL,
  id_cuenta_destino     INT UNSIGNED  NOT NULL,
  id_telefono_origen    INT UNSIGNED  NULL,
  id_telefono_destino   INT UNSIGNED  NULL,
  monto                 DECIMAL(18,2) NOT NULL,
  detalle               VARCHAR(140)  NULL,
  fecha                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  saldo_origen_despues  DECIMAL(18,2) NOT NULL,
  saldo_destino_despues DECIMAL(18,2) NOT NULL,
  CONSTRAINT ck_transferencia_monto   CHECK (monto > 0),
  CONSTRAINT ck_transferencia_cuentas CHECK (id_cuenta_origen <> id_cuenta_destino),
  CONSTRAINT ck_transferencia_sinpe   CHECK (
        (tipo = 'SINPE' AND id_telefono_origen IS NOT NULL AND id_telefono_destino IS NOT NULL)
     OR (tipo = 'IBAN'  AND id_telefono_origen IS NULL     AND id_telefono_destino IS NULL)),
  CONSTRAINT fk_transf_cuenta_origen   FOREIGN KEY (id_cuenta_origen)    REFERENCES cuenta (id_cuenta),
  CONSTRAINT fk_transf_cuenta_destino  FOREIGN KEY (id_cuenta_destino)   REFERENCES cuenta (id_cuenta),
  CONSTRAINT fk_transf_tel_origen      FOREIGN KEY (id_telefono_origen)  REFERENCES telefono (id_telefono),
  CONSTRAINT fk_transf_tel_destino     FOREIGN KEY (id_telefono_destino) REFERENCES telefono (id_telefono),
  INDEX ix_transf_origen_fecha  (id_cuenta_origen, fecha),
  INDEX ix_transf_destino_fecha (id_cuenta_destino, fecha)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Usuarios de la aplicación (operadores). Contraseña con hash SHA-256 + sal.
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
  id_usuario  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  correo      VARCHAR(120) NOT NULL,
  nombre      VARCHAR(80)  NOT NULL,
  sal         CHAR(16)     NOT NULL,
  clave_hash  CHAR(64)     NOT NULL,
  CONSTRAINT uq_usuario_correo UNIQUE (correo)
) ENGINE = InnoDB;
