# Cuenta Zen (Next.js + PostgreSQL)

Aplicacion monolitica para control de presupuesto familiar con:

- Next.js (frontend + API routes)
- PostgreSQL (compatible con Supabase)
- Prisma ORM
- Seguridad por clave global (sin sistema de usuarios)
- Flujo de cierres mensuales y precierres quincenales

## Funcionalidades principales

- Ingresos:
  - CRUD de `Income Templates`
  - Campos: nombre, monto, moneda, frecuencia, activo
  - Generacion automatica de ingresos mensuales al abrir cada mes
  - Cambios en templates solo afectan meses futuros
- Categorias:
  - CRUD completo
  - Campos: nombre, tipo, presupuesto mensual, moneda, control quincenal, alerta %, activa
  - Cambios en templates solo afectan meses futuros
- Gastos:
  - CRUD completo
  - Campos: category_id, monto, moneda, pagado_por, fecha automatica, comentario
  - Impacto inmediato en el presupuesto del mes activo
- Moneda:
  - CRC/USD
  - Tipo de cambio editable en settings
  - Conversion automatica USD->CRC para calculos globales
- Dashboard:
  - Ingresos, gastos, saldo y proyeccion de fin de mes
  - Semaforo global
  - Tabla por categoria con alertas
  - Vista de control quincenal por categoria cuando aplica
- Cierre mensual:
  - Cierre del mes, bloqueo de edicion y snapshot en `month_closures`
  - Creacion automatica del siguiente mes
- Precierre quincenal:
  - Generacion de resumen parcial sin reiniciar datos
- Historial:
  - Vista de meses anteriores, comparativo y grafica simple
- Seguridad:
  - Middleware con cookie de sesion
  - Validacion server-side contra clave global hasheada
  - Clave editable desde configuracion

## Modelo de datos

Archivo: `prisma/schema.prisma`

Tablas principales:

- `app_settings`
- `budget_months`
- `income_templates`
- `month_incomes`
- `category_templates`
- `month_categories`
- `expenses`
- `month_closures`
- `fortnight_preclosures`

## Setup local

1. Copiar variables de entorno:

```bash
cp .env.example .env
```

2. Configurar `DATABASE_URL` a tu PostgreSQL/Supabase.
3. Instalar dependencias:

```bash
npm install
```

4. Generar cliente Prisma y crear esquema:

```bash
npm run db:generate
npm run db:push
```

5. Levantar la app:

```bash
npm run dev
```

## Variables de entorno

- `DATABASE_URL`: conexion a PostgreSQL
- `DEFAULT_GLOBAL_KEY`: clave inicial (primer arranque)
- `DEFAULT_EXCHANGE_RATE`: tipo de cambio inicial CRC por USD

## Deploy en Vercel

1. Subir repo a GitHub.
2. Crear proyecto en Vercel.
3. Definir env vars (`DATABASE_URL`, `DEFAULT_GLOBAL_KEY`, `DEFAULT_EXCHANGE_RATE`).
4. Build command: `npm run build`.
5. Antes del primer uso, correr `npm run db:push` contra la DB de produccion.

## Comandos utiles

- `npm run dev`: entorno local
- `npm run lint`: linting
- `npm run build`: build de produccion
- `npm run db:generate`: generar Prisma Client
- `npm run db:push`: sincronizar schema
- `npm run db:seed`: seed de settings iniciales
