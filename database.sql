-- ============================================================
--  PONLO EN CAJA — Base de Datos
--  Compatible con MySQL 8.0+ / MySQL Workbench
--  Ejecutar en MySQL Workbench: File > Open SQL Script
-- ============================================================

CREATE DATABASE IF NOT EXISTS ponlo_en_caja
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ponlo_en_caja;

-- ------------------------------------------------------------
-- TABLA: clientes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  registro        VARCHAR(20)     NOT NULL UNIQUE,          -- CL-2024-001
  nombre          VARCHAR(80)     NOT NULL,
  apellido        VARCHAR(80)     NOT NULL,
  empresa         VARCHAR(160)    NOT NULL,
  telefono        VARCHAR(30),
  correo          VARCHAR(120),
  direccion       VARCHAR(255),
  ciudad          VARCHAR(80),
  estado          VARCHAR(80),
  codigo_postal   VARCHAR(10),
  activo          TINYINT(1)      NOT NULL DEFAULT 1,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_empresa (empresa),
  INDEX idx_correo  (correo)
) ENGINE=InnoDB;

-- Procedimiento para auto-generar el campo `registro` (CL-YYYY-NNN)
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS generar_registro_cliente(OUT p_registro VARCHAR(20))
BEGIN
  DECLARE n INT;
  SELECT IFNULL(MAX(CAST(SUBSTRING_INDEX(registro,'-',-1) AS UNSIGNED)), 0) + 1
    INTO n
    FROM clientes
   WHERE registro LIKE CONCAT('CL-', YEAR(NOW()), '-%');
  SET p_registro = CONCAT('CL-', YEAR(NOW()), '-', LPAD(n, 3, '0'));
END$$
DELIMITER ;

-- Trigger: asigna `registro` antes de insertar
DELIMITER $$
CREATE TRIGGER IF NOT EXISTS before_insert_clientes
BEFORE INSERT ON clientes
FOR EACH ROW
BEGIN
  DECLARE v_reg VARCHAR(20);
  IF NEW.registro IS NULL OR NEW.registro = '' THEN
    CALL generar_registro_cliente(v_reg);
    SET NEW.registro = v_reg;
  END IF;
END$$
DELIMITER ;

-- ------------------------------------------------------------
-- TABLA: tipos_carton
-- (catálogo fijo, editable desde backend)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipos_carton (
  id          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(60)      NOT NULL,
  costo_m2    DECIMAL(8,2)     NOT NULL,
  activo      TINYINT(1)       NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

INSERT INTO tipos_carton (nombre, costo_m2) VALUES
  ('Sencillo',    11.00),
  ('Micro',       14.00),
  ('Doble Pared', 17.00)
ON DUPLICATE KEY UPDATE costo_m2 = VALUES(costo_m2);

-- ------------------------------------------------------------
-- TABLA: tipos_venta
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipos_venta (
  id          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(60)      NOT NULL,
  multiplicador DECIMAL(5,3)   NOT NULL,
  activo      TINYINT(1)       NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

INSERT INTO tipos_venta (nombre, multiplicador) VALUES
  ('Mayoreo',        1.700),
  ('Medio Mayoreo',  2.500),
  ('Menudeo',        3.000),
  ('Exportación',    2.200),
  ('Directa',        1.900)
ON DUPLICATE KEY UPDATE multiplicador = VALUES(multiplicador);

-- ------------------------------------------------------------
-- TABLA: cotizaciones
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cotizaciones (
  id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  folio               VARCHAR(20)     NOT NULL UNIQUE,      -- COT-2024-001
  cliente_id          INT UNSIGNED    NOT NULL,
  tipo_cotizacion     ENUM('plano','medidas') NOT NULL DEFAULT 'plano',
  tipo_carton_id      TINYINT UNSIGNED NOT NULL,
  tipo_venta_id       TINYINT UNSIGNED NOT NULL,

  -- Dimensiones (cm)
  largo               DECIMAL(10,2)   NOT NULL DEFAULT 0,
  ancho               DECIMAL(10,2)   NOT NULL DEFAULT 0,
  alto                DECIMAL(10,2)   NOT NULL DEFAULT 0,

  -- Cantidad
  cantidad            INT UNSIGNED    NOT NULL DEFAULT 1,

  -- Costos adicionales
  costo_suaje         DECIMAL(12,2)   NOT NULL DEFAULT 0,
  costo_marco         DECIMAL(12,2)   NOT NULL DEFAULT 0,
  costo_pintura       DECIMAL(12,2)   NOT NULL DEFAULT 0,
  incluye_serigrafia  TINYINT(1)      NOT NULL DEFAULT 0,

  -- Resultados calculados (guardados para historico)
  precio_unitario     DECIMAL(14,4)   NOT NULL DEFAULT 0,
  subtotal            DECIMAL(14,2)   NOT NULL DEFAULT 0,
  iva                 DECIMAL(14,2)   NOT NULL DEFAULT 0,
  total               DECIMAL(14,2)   NOT NULL DEFAULT 0,

  -- Estado
  estatus             ENUM('borrador','pendiente','en_revision','aprobada','rechazada')
                      NOT NULL DEFAULT 'pendiente',
  notas               TEXT,
  vigencia_dias       SMALLINT        NOT NULL DEFAULT 15,

  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_cot_cliente   FOREIGN KEY (cliente_id)     REFERENCES clientes(id)      ON DELETE RESTRICT,
  CONSTRAINT fk_cot_carton    FOREIGN KEY (tipo_carton_id) REFERENCES tipos_carton(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_cot_venta     FOREIGN KEY (tipo_venta_id)  REFERENCES tipos_venta(id)   ON DELETE RESTRICT,
  INDEX idx_cliente_id  (cliente_id),
  INDEX idx_estatus     (estatus),
  INDEX idx_created_at  (created_at)
) ENGINE=InnoDB;

-- Trigger: auto-folio para cotizaciones (COT-YYYY-NNN)
DELIMITER $$
CREATE TRIGGER IF NOT EXISTS before_insert_cotizaciones
BEFORE INSERT ON cotizaciones
FOR EACH ROW
BEGIN
  DECLARE n INT;
  IF NEW.folio IS NULL OR NEW.folio = '' THEN
    SELECT IFNULL(MAX(CAST(SUBSTRING_INDEX(folio,'-',-1) AS UNSIGNED)), 0) + 1
      INTO n FROM cotizaciones
     WHERE folio LIKE CONCAT('COT-', YEAR(NOW()), '-%');
    SET NEW.folio = CONCAT('COT-', YEAR(NOW()), '-', LPAD(n, 3, '0'));
  END IF;
END$$
DELIMITER ;

-- ------------------------------------------------------------
-- DATOS DE EJEMPLO
-- ------------------------------------------------------------
INSERT INTO clientes (registro, nombre, apellido, empresa, telefono, correo, ciudad, estado) VALUES
  ('CL-2024-001', 'Roberto',  'Méndez',    'Cartonajes Estrella S.A. de C.V.',  '+52 55 4892 1022', 'r.mendez@estrella.mx',     'CDMX',      'Ciudad de México'),
  ('CL-2024-002', 'Silvia',   'Pinal',     'Empaques Modernos de México',       '+52 33 1205 9934', 's.pinal@empaques.mx',       'Guadalajara','Jalisco'),
  ('CL-2024-003', 'Carlos',   'Gómez',     'Logística & Corrugados del Norte',  '+52 81 8345 6789', 'c.gomez@logisticacn.mx',   'Monterrey', 'Nuevo León'),
  ('CL-2024-004', 'Martha',   'Sánchez',   'Soluciones Box-Pack S.A.',          '+52 55 5678 1234', 'm.sanchez@boxpack.mx',      'CDMX',      'Ciudad de México'),
  ('CL-2024-005', 'Luis',     'Torres',    'Empaques del Norte S.A.',           '+52 81 8290 4455', 'l.torres@empnorte.mx',     'Monterrey', 'Nuevo León');

INSERT INTO cotizaciones
  (folio, cliente_id, tipo_cotizacion, tipo_carton_id, tipo_venta_id,
   largo, ancho, alto, cantidad, costo_suaje, costo_marco, costo_pintura,
   incluye_serigrafia, precio_unitario, subtotal, iva, total, estatus)
VALUES
  ('COT-2024-001', 1, 'plano',   1, 1,  40, 30,  0, 500,  0,    0,    0, 0,  7.15,  3575.00,  572.00,  4147.00, 'aprobada'),
  ('COT-2024-002', 2, 'medidas', 2, 2,  50, 40, 30, 200, 800, 1200, 2.50, 1, 22.30,  5260.00,  841.60,  6101.60, 'pendiente'),
  ('COT-2024-003', 3, 'plano',   3, 4,  60, 50,  0,1000,  0,    0,    0, 0, 32.50, 32500.00, 5200.00, 37700.00, 'en_revision'),
  ('COT-2024-004', 4, 'medidas', 1, 1,  25, 20, 15, 300,  0,    0,    0, 0,  4.20,  1260.00,  201.60,  1461.60, 'rechazada');

-- ============================================================
--  VISTAS ÚTILES
-- ============================================================

-- Vista resumen de cotizaciones con datos de cliente
CREATE OR REPLACE VIEW v_cotizaciones AS
SELECT
  c.id,
  c.folio,
  c.estatus,
  c.total,
  c.cantidad,
  c.created_at,
  cl.id          AS cliente_id,
  cl.registro    AS cliente_registro,
  CONCAT(cl.nombre,' ',cl.apellido) AS cliente_contacto,
  cl.empresa     AS cliente_empresa,
  tc.nombre      AS tipo_carton,
  tv.nombre      AS tipo_venta
FROM cotizaciones c
JOIN clientes     cl ON cl.id = c.cliente_id
JOIN tipos_carton tc ON tc.id = c.tipo_carton_id
JOIN tipos_venta  tv ON tv.id = c.tipo_venta_id;

-- Vista clientes con cantidad de cotizaciones
CREATE OR REPLACE VIEW v_clientes_resumen AS
SELECT
  cl.*,
  COUNT(c.id)          AS total_cotizaciones,
  SUM(c.total)         AS valor_total,
  MAX(c.created_at)    AS ultima_cotizacion
FROM clientes cl
LEFT JOIN cotizaciones c ON c.cliente_id = cl.id
GROUP BY cl.id;
