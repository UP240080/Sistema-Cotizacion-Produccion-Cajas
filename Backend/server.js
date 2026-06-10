/**
 * PONLO EN CAJA — Backend API
 * Node.js + Express + MySQL2
 *
 * Instalación:
 *   npm install
 *   node server.js
 *
 * Requiere Node.js >= 18
 */

const express  = require('express');
const mysql    = require('mysql2/promise');
const cors     = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// ──────────────────────────────────────────────────────────
// Middlewares
// ──────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static('../'));   // sirve los HTML desde la raíz del proyecto

// ──────────────────────────────────────────────────────────
// Conexión a MySQL
// ──────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host     : process.env.DB_HOST     || 'localhost',
  user     : process.env.DB_USER     || 'root',
  password : process.env.DB_PASSWORD || '17sep2006',   // ← CAMBIA ESTO
  database : process.env.DB_NAME     || 'ponlo_en_caja',
  waitForConnections: true,
  connectionLimit   : 10,
});

// Helper: respuesta estándar
const ok  = (res, datos, codigo = 200) => res.status(codigo).json({ ok: true,  datos });
const err = (res, mensaje, codigo = 400) => res.status(codigo).json({ ok: false, mensaje });

// ══════════════════════════════════════════════════════════
//  CLIENTES
// ══════════════════════════════════════════════════════════

/**
 * GET /api/clientes
 * Query params: buscar, pagina, limite
 */
app.get('/api/clientes', async (req, res) => {
  try {
    const { buscar = '', pagina = 1, limite = 10 } = req.query;
    const offset = (parseInt(pagina) - 1) * parseInt(limite);
    const like   = `%${buscar}%`;

    const [rows] = await pool.query(
      `SELECT id, registro, nombre, apellido, empresa, telefono, correo,
              ciudad, estado, codigo_postal, created_at
       FROM clientes
       WHERE activo = 1
         AND (empresa LIKE ? OR nombre LIKE ? OR apellido LIKE ? OR correo LIKE ?)
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [like, like, like, like, parseInt(limite), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM clientes
       WHERE activo = 1 AND (empresa LIKE ? OR nombre LIKE ? OR apellido LIKE ? OR correo LIKE ?)`,
      [like, like, like, like]
    );

    ok(res, {
      clientes: rows,
      paginacion: { total, pagina: parseInt(pagina), limite: parseInt(limite) }
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

/**
 * GET /api/clientes/:id
 */
app.get('/api/clientes/:id', async (req, res) => {
  try {
    const [[cliente]] = await pool.query(
      'SELECT * FROM clientes WHERE id = ? AND activo = 1',
      [req.params.id]
    );
    if (!cliente) return err(res, 'Cliente no encontrado', 404);
    ok(res, cliente);
  } catch (e) {
    err(res, e.message, 500);
  }
});

/**
 * POST /api/clientes
 * Body: { nombre, apellido, empresa, telefono, correo, direccion, ciudad, estado, codigoPostal }
 */
app.post('/api/clientes', async (req, res) => {
  try {
    const { nombre, apellido, empresa, telefono, correo,
            direccion, ciudad, estado, codigoPostal } = req.body;

    if (!nombre || !apellido || !empresa) {
      return err(res, 'nombre, apellido y empresa son requeridos');
    }

    const [result] = await pool.query(
      `INSERT INTO clientes
         (registro, nombre, apellido, empresa, telefono, correo,
          direccion, ciudad, estado, codigo_postal)
       VALUES ('', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, apellido, empresa, telefono || null, correo || null,
       direccion || null, ciudad || null, estado || null, codigoPostal || null]
    );

    const [[nuevo]] = await pool.query(
      'SELECT * FROM clientes WHERE id = ?', [result.insertId]
    );

    ok(res, nuevo, 201);
  } catch (e) {
    err(res, e.message, 500);
  }
});

/**
 * PUT /api/clientes/:id
 */
app.put('/api/clientes/:id', async (req, res) => {
  try {
    const { nombre, apellido, empresa, telefono, correo,
            direccion, ciudad, estado, codigoPostal } = req.body;

    const [result] = await pool.query(
      `UPDATE clientes
         SET nombre=?, apellido=?, empresa=?, telefono=?,
             correo=?, direccion=?, ciudad=?, estado=?, codigo_postal=?
       WHERE id=? AND activo=1`,
      [nombre, apellido, empresa, telefono, correo,
       direccion, ciudad, estado, codigoPostal, req.params.id]
    );

    if (result.affectedRows === 0) return err(res, 'Cliente no encontrado', 404);

    const [[actualizado]] = await pool.query(
      'SELECT * FROM clientes WHERE id=?', [req.params.id]
    );
    ok(res, actualizado);
  } catch (e) {
    err(res, e.message, 500);
  }
});

/**
 * DELETE /api/clientes/:id  (soft delete)
 */
app.delete('/api/clientes/:id', async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE clientes SET activo=0 WHERE id=? AND activo=1',
      [req.params.id]
    );
    if (result.affectedRows === 0) return err(res, 'Cliente no encontrado', 404);
    ok(res, { operacionId: `DEL-${Date.now()}`, id: req.params.id });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ══════════════════════════════════════════════════════════
//  COTIZACIONES
// ══════════════════════════════════════════════════════════

/**
 * GET /api/cotizaciones
 * Query: buscar, estatus, pagina, limite
 */
app.get('/api/cotizaciones', async (req, res) => {
  try {
    const { buscar = '', estatus = '', pagina = 1, limite = 10 } = req.query;
    const offset = (parseInt(pagina) - 1) * parseInt(limite);
    const like   = `%${buscar}%`;

    let where = 'WHERE 1=1';
    const params = [];

    if (buscar) {
      where += ' AND (c.folio LIKE ? OR cl.empresa LIKE ?)';
      params.push(like, like);
    }
    if (estatus) {
      where += ' AND c.estatus = ?';
      params.push(estatus);
    }

    const [rows] = await pool.query(
      `SELECT c.id, c.folio, c.estatus, c.total, c.cantidad, c.created_at,
              cl.id AS cliente_id, cl.empresa AS cliente_empresa,
              CONCAT(cl.nombre,' ',cl.apellido) AS cliente_contacto,
              tc.nombre AS tipo_carton, tv.nombre AS tipo_venta
       FROM cotizaciones c
       JOIN clientes     cl ON cl.id = c.cliente_id
       JOIN tipos_carton tc ON tc.id = c.tipo_carton_id
       JOIN tipos_venta  tv ON tv.id = c.tipo_venta_id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limite), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM cotizaciones c
       JOIN clientes cl ON cl.id = c.cliente_id
       ${where}`,
      params
    );

    ok(res, {
      cotizaciones: rows,
      paginacion: { total, pagina: parseInt(pagina), limite: parseInt(limite) }
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

/**
 * GET /api/cotizaciones/:id
 */
app.get('/api/cotizaciones/:id', async (req, res) => {
  try {
    const [[cot]] = await pool.query(
      `SELECT c.*, cl.empresa AS cliente_empresa,
              CONCAT(cl.nombre,' ',cl.apellido) AS cliente_contacto,
              tc.nombre AS tipo_carton_nombre, tv.nombre AS tipo_venta_nombre
       FROM cotizaciones c
       JOIN clientes     cl ON cl.id = c.cliente_id
       JOIN tipos_carton tc ON tc.id = c.tipo_carton_id
       JOIN tipos_venta  tv ON tv.id = c.tipo_venta_id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (!cot) return err(res, 'Cotización no encontrada', 404);
    ok(res, cot);
  } catch (e) {
    err(res, e.message, 500);
  }
});

/**
 * GET /api/cotizaciones/cliente/:clienteId
 * Todas las cotizaciones de un cliente
 */
app.get('/api/cotizaciones/cliente/:clienteId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.folio, c.estatus, c.total, c.cantidad, c.created_at,
              tc.nombre AS tipo_carton, tv.nombre AS tipo_venta
       FROM cotizaciones c
       JOIN tipos_carton tc ON tc.id = c.tipo_carton_id
       JOIN tipos_venta  tv ON tv.id = c.tipo_venta_id
       WHERE c.cliente_id = ?
       ORDER BY c.created_at DESC`,
      [req.params.clienteId]
    );
    ok(res, rows);
  } catch (e) {
    err(res, e.message, 500);
  }
});

/**
 * POST /api/cotizaciones
 */
app.post('/api/cotizaciones', async (req, res) => {
  try {
    const {
      clienteId, tipoCotizacion, tipoCartonId, tipoVentaId,
      largo, ancho, alto, cantidad,
      costoSuaje, costoMarco, costoPintura, incluyeSerigrafia,
      precioUnitario, subtotal, iva, total,
      estatus = 'pendiente', notas
    } = req.body;

    if (!clienteId || !tipoCartonId || !tipoVentaId) {
      return err(res, 'clienteId, tipoCartonId y tipoVentaId son requeridos');
    }

    const [result] = await pool.query(
      `INSERT INTO cotizaciones
         (folio, cliente_id, tipo_cotizacion, tipo_carton_id, tipo_venta_id,
          largo, ancho, alto, cantidad,
          costo_suaje, costo_marco, costo_pintura, incluye_serigrafia,
          precio_unitario, subtotal, iva, total, estatus, notas)
       VALUES ('', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [clienteId, tipoCotizacion || 'plano', tipoCartonId, tipoVentaId,
       largo || 0, ancho || 0, alto || 0, cantidad || 1,
       costoSuaje || 0, costoMarco || 0, costoPintura || 0, incluyeSerigrafia ? 1 : 0,
       precioUnitario || 0, subtotal || 0, iva || 0, total || 0,
       estatus, notas || null]
    );

    const [[nueva]] = await pool.query(
      'SELECT * FROM cotizaciones WHERE id=?', [result.insertId]
    );
    ok(res, nueva, 201);
  } catch (e) {
    err(res, e.message, 500);
  }
});

/**
 * PATCH /api/cotizaciones/:id/estatus
 * Body: { estatus }
 */
app.patch('/api/cotizaciones/:id/estatus', async (req, res) => {
  try {
    const { estatus } = req.body;
    const validos = ['borrador','pendiente','en_revision','aprobada','rechazada'];
    if (!validos.includes(estatus)) return err(res, 'Estatus no válido');

    const [result] = await pool.query(
      'UPDATE cotizaciones SET estatus=? WHERE id=?',
      [estatus, req.params.id]
    );
    if (result.affectedRows === 0) return err(res, 'Cotización no encontrada', 404);
    ok(res, { id: req.params.id, estatus });
  } catch (e) {
    err(res, e.message, 500);
  }
});

/**
 * DELETE /api/cotizaciones/:id
 */
app.delete('/api/cotizaciones/:id', async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM cotizaciones WHERE id=?', [req.params.id]
    );
    if (result.affectedRows === 0) return err(res, 'Cotización no encontrada', 404);
    ok(res, { operacionId: `DEL-${Date.now()}`, id: req.params.id });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ══════════════════════════════════════════════════════════
//  CATÁLOGOS
// ══════════════════════════════════════════════════════════

app.get('/api/catalogos/carton',  async (_, res) => {
  const [rows] = await pool.query('SELECT * FROM tipos_carton  WHERE activo=1');
  ok(res, rows);
});
app.get('/api/catalogos/venta', async (_, res) => {
  const [rows] = await pool.query('SELECT * FROM tipos_venta WHERE activo=1');
  ok(res, rows);
});

// ══════════════════════════════════════════════════════════
//  DASHBOARD — estadísticas rápidas
// ══════════════════════════════════════════════════════════
app.get('/api/dashboard/stats', async (_, res) => {
  try {
    const [[{ total_clientes }]] = await pool.query(
      'SELECT COUNT(*) AS total_clientes FROM clientes WHERE activo=1'
    );
    const [[{ total_cotizaciones, valor_total }]] = await pool.query(
      'SELECT COUNT(*) AS total_cotizaciones, IFNULL(SUM(total),0) AS valor_total FROM cotizaciones'
    );
    const [por_estatus] = await pool.query(
      'SELECT estatus, COUNT(*) AS cantidad FROM cotizaciones GROUP BY estatus'
    );
    ok(res, { total_clientes, total_cotizaciones, valor_total, por_estatus });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ──────────────────────────────────────────────────────────
app.listen(PORT, () =>
  console.log(`✅  Servidor corriendo en http://localhost:${PORT}`)
);
