# Publicar en Vercel (con MongoDB Atlas y Supabase)

Tres servicios: **Vercel** aloja el sitio, **MongoDB Atlas** guarda los artículos y **Supabase Storage** guarda las fotos.

## 1. MongoDB Atlas (base de datos)

1. Creá una cuenta en https://www.mongodb.com/atlas y un cluster gratuito (M0).
2. *Database Access* → creá un usuario con contraseña **fuerte** y permiso de lectura y escritura.
3. *Network Access* → agregá `0.0.0.0/0`. Vercel no tiene IP fija; la seguridad la da la contraseña del usuario.
4. *Connect → Drivers* → copiá la URI y ponele el nombre de la base: `mongodb+srv://USUARIO:CLAVE@cluster.mongodb.net/catalogo_electronorte`. Si la clave tiene símbolos (`@`, `/`, `:`), codificalos (por ejemplo `@` → `%40`).

## 2. Supabase (fotos)

1. Creá un proyecto en https://supabase.com.
2. *Storage* → *New bucket* llamado `productos`, marcado como **Public bucket** (las fotos se ven sin iniciar sesión).
3. *Project Settings → API* → copiá la **Project URL** y la clave **service_role**. La `service_role` da acceso total: va solo en las variables de Vercel, nunca en el navegador ni en un archivo que se suba a Git.

## 3. Vercel (sitio)

1. Subí el proyecto a un repositorio (GitHub, GitLab o Bitbucket). `.env.local` no se sube: está en `.gitignore`.
2. En https://vercel.com → *Add New → Project* → importá el repositorio. Framework: Next.js (se detecta solo).
3. En *Settings → Environment Variables* cargá:

   | Variable | Valor |
   |---|---|
   | `MONGODB_URI` | la URI de Atlas del paso 1 |
   | `ADMIN_PASSWORD` | la contraseña del panel |
   | `SUPABASE_URL` | la Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | la clave `service_role` |
   | `SUPABASE_BUCKET` | `productos` |
   | `NEXT_PUBLIC_STORE_NAME` | `Electronorte` |

4. *Deploy*. Si cambiás una variable después, hay que volver a desplegar.

## 4. Después del deploy

1. Entrá a `https://TU-DOMINIO/admin` e iniciá sesión.
2. *WhatsApp y promos*: cargá el número de WhatsApp, las fechas BBVA y revisá las sucursales.
3. *Importar / Exportar*: subí el Excel de artículos (hasta 4 MB por archivo; si es más grande, dividilo).
4. Subí una foto a un artículo y comprobá que se ve en el catálogo. Se achica sola a 1200 px de ancho en WebP.

## Límites de Vercel a tener en cuenta

- Cada pedido admite hasta ~4,5 MB. Por eso las fotos se achican en el navegador antes de subirse y el tope es de 4 MB.
- Las funciones tienen un tiempo máximo. La importación y la exportación piden hasta 60 s; el plan gratuito puede limitarlo más. Si una importación grande se corta, subí el archivo en partes (el SKU evita duplicados).
- El plan gratuito (Hobby) es para uso no comercial según los términos de Vercel; para el sitio de un negocio revisá si corresponde el plan Pro.
- Sin las tres variables `SUPABASE_*` el sitio guarda las fotos en una carpeta local, que en Vercel no es permanente. Siempre configurá Supabase en producción.
