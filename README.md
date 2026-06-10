# Ponlo en Caja — Sistema Industrial
## Instrucciones de instalación y configuración

---

## Estructura del proyecto

```
ponlo-en-caja/
├── cotizador.html          ← App principal (abre esto en el navegador)
├── database.sql            ← Script para MySQL Workbench
├── README.md
└── backend/
    ├── server.js           ← API Node.js
    └── package.json
```

---

## 1. Configurar la base de datos (MySQL Workbench)

1. Abre **MySQL Workbench** y conéctate a tu servidor local.
2. Ve a **File → Open SQL Script** y abre `database.sql`.
3. Haz clic en ⚡ **Execute (Ctrl+Shift+Enter)** para correr todo el script.
4. Verifica que se creó la base de datos `ponlo_en_caja` con las tablas:
   - `clientes`
   - `cotizaciones`
   - `tipos_carton`
   - `tipos_venta`
5. Los datos de ejemplo se insertan automáticamente.

---

## 2. Configurar el backend

### Requisitos
- Node.js 18 o superior
- MySQL corriendo en localhost:3306

### Instalación

```bash
cd backend
npm install
```

### Configurar contraseña de MySQL

Edita `backend/server.js`, línea 24:
```js
password : 'tu_password',   // ← CAMBIA ESTO por tu contraseña de MySQL
```

O usa variables de entorno (recomendado):
```bash
export DB_PASSWORD=mi_password
node server.js
```

### Iniciar el servidor

```bash
cd backend
npm start
# Servidor corriendo en http://localhost:3000
```

---

## 3. Abrir la aplicación

Simplemente abre `cotizador.html` en tu navegador. El archivo hace peticiones a `http://localhost:3000/api`.

> **Importante:** el backend debe estar corriendo antes de abrir el HTML.

---

## API disponible

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/clientes` | Lista clientes (paginado, búsqueda) |
| GET | `/api/clientes/:id` | Detalle de un cliente |
| POST | `/api/clientes` | Crear cliente |
| PUT | `/api/clientes/:id` | Actualizar cliente |
| DELETE | `/api/clientes/:id` | Eliminar cliente (soft delete) |
| GET | `/api/cotizaciones` | Lista cotizaciones |
| GET | `/api/cotizaciones/:id` | Detalle cotización |
| GET | `/api/cotizaciones/cliente/:id` | Cotizaciones de un cliente |
| POST | `/api/cotizaciones` | Crear cotización |
| PATCH | `/api/cotizaciones/:id/estatus` | Cambiar estatus |
| DELETE | `/api/cotizaciones/:id` | Eliminar cotización |
| GET | `/api/catalogos/carton` | Tipos de cartón |
| GET | `/api/catalogos/venta` | Tipos de venta |
| GET | `/api/dashboard/stats` | Estadísticas generales |

---

## Navegación entre módulos

El sistema está unificado en un solo HTML con los siguientes módulos:

- **Cotizaciones** — listado con datos reales del backend
- **Nueva Cotización** — busca cliente del CRM, calcula precio, guarda en DB
- **Clientes (CRM)** — directorio completo: ver, crear, editar, eliminar
- **Detalle de Cliente** — historial de cotizaciones vinculadas + botón "Nueva Cotización"
- **Órdenes / Producción** — módulos en construcción

---

## Notas técnicas

- El HTML usa **CORS** para conectarse al backend — si abres el archivo directamente con `file://` puede haber bloqueos. Usa un servidor local simple si es necesario:
  ```bash
  npx serve .
  # o
  python -m http.server 8080
  ```
- La base de datos usa **soft delete** para clientes (campo `activo`).
- Los folios (`CL-YYYY-NNN`, `COT-YYYY-NNN`) se generan automáticamente por triggers en MySQL.
