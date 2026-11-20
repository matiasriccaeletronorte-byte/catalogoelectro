# Categorías en varios niveles: diseño

Fecha: 2026-11-19 · Estado: pendiente de revisión del usuario

## 1. Objetivo

Hoy cada artículo tiene `category` y `subCategory` (dos niveles). Se necesita un **árbol de categorías sin límite de niveles** (ej.: Climatización › Aires acondicionados › Split), administrable desde el panel, navegable en la tienda con un menú por niveles y con direcciones por camino, sin cambiar la paleta de colores.

Éxito = el dueño crea y mueve categorías a cualquier nivel desde el admin; el cliente llega a "Split" por el menú, por el listado o por una dirección compartida; Google ve la jerarquía; ningún artículo queda sin categoría ni se pierde en la migración.

## 2. Decisiones ya tomadas con el usuario

- Árbol sin límite técnico de niveles (en la práctica 3 o 4).
- Un artículo pertenece a **una sola** categoría del árbol. Al mirar un nivel superior se ve todo lo que hay debajo.
- Direcciones **por camino**: `/catalogo/climatizacion/aires-acondicionados/split`. Los enlaces viejos `?category=…` redirigen.
- El **árbol inicial lo arma Claude** a partir de las 28 categorías actuales (hoy sin subcategorías); el usuario lo revisa con cantidades por rama **antes** de aplicarlo y lo corrige desde el admin.
- Menú "Categorías" con panel de dos zonas (ver §10). **No se cambia la paleta**: la categoría activa va en el rojo de marca.

## 3. Alcance

**Entra:** modelo y lógica del árbol; migración; pestaña Categorías del admin como árbol; selector en cascada en el formulario de artículo; importación/exportación con caminos; convertidor de Contabilium con caminos; rutas por camino, listado, filtros, migas y redirecciones; SEO (títulos, canónicas, migas en datos estructurados, mapa del sitio); menú por niveles.

**No entra (YAGNI):** artículo en varias categorías; orden manual de categorías (alfabético, "Otros" siempre al final); filtros propios por categoría (frigorías, pulgadas); imágenes por subcategoría (las imágenes de la tira de la home siguen siendo de primer nivel).

## 4. Modelo de datos

**Nueva colección `categorynodes`** (modelo `CategoryNode`):
- `name` (texto), `slug` (texto), `parentId` (ObjectId o `null` para primer nivel).
- `slug` = nombre sin tildes, en minúsculas, con guiones; único entre hermanos (si choca se agrega `-2`).
- Únicos por `(parentId, slug)` y por `(parentId, nombre sin tildes ni mayúsculas)`.

**`Product` agrega:**
- `categoryId` (ObjectId, el nodo donde está) y `categoryPath` (array de ObjectId, de la raíz al nodo, incluido). Índice multikey sobre `categoryPath`: "todo lo de Climatización" = `categoryPath: <idClimatización>`.
- `category` y `subCategory` **se conservan como copia derivada**: `category` = nombre del nivel 1, `subCategory` = nombre del nivel 2 (o vacío). Ya no se editan a mano; el sistema las recalcula. Así siguen funcionando el texto de búsqueda, los estantes de la home y el resto de los ~40 archivos que las leen.

**Modelo `Category` actual** (lista plana con `subCategories`): se migra y queda sin uso; se elimina en una limpieza posterior, no en este trabajo.

## 5. Lógica del árbol (`src/lib/category-tree.ts`, funciones puras con tests)

`slugify`, `uniqueSlug`, `buildTree(nodes)`, `pathOf(id)`, `resolveSlugs(slugs[])` → nodo o `null`, `descendantIds(id)`, `canMove(id, newParentId)` (rechaza moverla dentro de sí misma o de sus descendientes), `breadcrumb(id)`, `formatPath(nodos)` → `"A > B > C"`, `parsePathText("A > B > C")` (separador `>`; los nombres pueden contener `/`), y búsqueda de un nodo por nombre sin distinguir tildes ni mayúsculas.

**Reglas de operaciones** (API admin, todas con sesión de administrador):
- Crear `{parentId|null, name}`: valida duplicados entre hermanos.
- Renombrar: cambia `name` y `slug`; recalcula `category`/`subCategory`/texto de búsqueda de los artículos de la rama.
- Mover `{id, newParentId}`: usa `canMove`; recalcula `categoryPath` y los campos derivados de todos los artículos de la rama (actualización masiva).
- Mover artículos `{fromId, toId}`: reasigna todos los artículos de una categoría (y sus descendientes) a otra.
- Borrar: solo si no tiene subcategorías ni artículos (409 con el motivo, como hoy).
- Cada cambio invalida la caché corta del árbol.

## 6. Migración y árbol inicial

- **Conversión de lo actual:** operación idempotente `convertirCategoriasPlanas`: crea un nodo de primer nivel por cada `category` distinta, asigna `categoryId`/`categoryPath` a cada artículo y migra las subcategorías guardadas (hoy ninguna). En el admin aparece un aviso "Convertir las categorías actuales al nuevo árbol" mientras haya artículos sin `categoryId`. No corre sola en pedidos públicos.
- **Árbol inicial (lo arma Claude):** `scripts/arbol-categorias.mjs` agrupa las 28 categorías en ~10 principales y baja un nivel más en los aires acondicionados (Split, Portátil, Ventana, por palabras del nombre). El convertidor de Contabilium escribe los caminos en el Excel y **muestra el árbol propuesto con cantidades por rama en el informe, antes de importar**. Se aplica importando el Excel (vista previa primero); después el usuario lo corrige desde el admin.
- **Producción:** Claude no accede a la base de la nube. El árbol llega por el Excel (el convertidor de Contabilium escribe los caminos y la importación crea los nodos y reasigna los artículos por SKU) más el botón de conversión del admin.
- **Criterio de aceptación de la migración:** 0 artículos sin `categoryId` y el total de artículos antes = después.

## 7. Admin

- **Pestaña Categorías:** árbol que se abre y cierra, con la cantidad de artículos por rama. Acciones por nodo: agregar subcategoría, renombrar, mover (elegir nuevo padre), mover sus artículos a otra categoría, borrar.
- **Formulario de artículo:** selectores en cascada (nivel 1 → nivel 2 → nivel 3…), sin texto libre. Enlace a "Gestionar categorías". La lista de productos muestra el camino completo.
- **Importar / Exportar:** ver §8.

## 8. Importación y exportación

- Columna Categoría (alias `categoria`, `rubro`, `category`) acepta el camino `Climatización > Aires acondicionados > Split`. Si además hay columna Subcategoría y la categoría no tiene `>`, el camino es `[categoría, subcategoría]` (compatibilidad con lo que ya se usa).
- Los nodos se buscan sin distinguir tildes ni mayúsculas; los que faltan se **crean al aplicar**, y la vista previa informa cuántas categorías nuevas se crearán y las lista.
- Exportación: la columna Categoría trae el camino completo.
- El convertidor de Contabilium (`contabilium-convertir.mjs`) deja de usar sus 28 categorías planas y escribe los caminos según `arbol-categorias.json`.

## 9. Tienda

**Rutas:** `src/app/catalogo/[[...path]]/page.tsx` atiende `/catalogo` y `/catalogo/a/b/c`. Un camino que no existe devuelve 404. Los demás filtros siguen en la dirección como parámetros (`q`, `brand`, `outlet`, `sort`, `page`).
- **Redirecciones:** `/catalogo?category=X[&subCategory=Y]` → 308 a la dirección por camino (resolviendo por nombre sin tildes ni mayúsculas). Si no se encuentra, se muestra el catálogo completo.
- **Consulta:** el filtro de categoría usa `categoryPath: <idNodo>` (incluye todos los descendientes). Las marcas y las cantidades salen solo de esa rama.
- **Listado:** migas de pan arriba; a la izquierda, las subcategorías del nivel actual con cantidad, y "Subir un nivel". El resto de los filtros se mantiene.
- **Ficha del artículo:** migas con el camino completo.
- **Home:** tira de categorías, estantes y enlaces usan el primer nivel y apuntan a `/catalogo/<slug>`.
- **SEO:** título y descripción propios por categoría, canónica a la dirección por camino, `noindex` cuando hay filtros por parámetro (regla actual), `BreadcrumbList` con el camino completo, y todas las categorías con artículos en el mapa del sitio.

## 10. Menú "Categorías"

Escritorio:
- Botón "Categorías" abre un panel grande (con ✕ para cerrar).
- **Izquierda:** categorías de primer nivel, cada una con ›. Pasar el mouse o hacer clic **abre su pestaña de subcategorías a la derecha y no navega**. Con retardo corto al pasar el mouse para evitar parpadeo. Si una categoría no tiene subcategorías, se comporta como un enlace directo.
- **Derecha:** nombre de la categoría + botón **"Ver todo"** (todos los artículos de la categoría padre) y, debajo, **columnas**: cada subcategoría de segundo nivel como título en negrita (enlace), sus subcategorías de tercer nivel como enlaces y un "Ver todo" al final de la columna. Niveles 4 en adelante se alcanzan desde el listado.
- Al elegir un destino, el panel se cierra. Esc también lo cierra. Categorías sin artículos no se muestran; "Otros" al final.
- Colores: categoría activa en el rojo de marca; resto con los tokens existentes.

Celular: se entra por niveles (lista → subcategorías), con "Ver todo [categoría]" siempre arriba y botón para volver.

Accesibilidad: `aria-expanded`, foco visible, navegación con flechas y Tab, foco atrapado mientras el panel está abierto en celular.

Datos: el árbol con cantidades llega desde el servidor al encabezado con una caché corta (60 s), invalidada al editar categorías.

## 11. Etapas (el sitio queda funcionando entre una y otra)

1. **Núcleo:** modelo, lógica con tests, conversión de lo actual, pestaña Categorías como árbol y selector en cascada. *Aceptación:* se crea Climatización › Aires › Split desde el admin y se asigna un artículo; la tienda sigue igual que hoy.
2. **Excel y Contabilium:** importación/exportación con caminos y convertidor. *Aceptación:* un Excel con caminos nuevos crea las categorías y reasigna por SKU; la vista previa las informa.
3. **Tienda:** rutas por camino, redirecciones, listado, migas, SEO y mapa del sitio. *Aceptación:* `/catalogo/climatizacion/aires-acondicionados` lista los artículos de esa rama; el enlace viejo redirige.
4. **Menú por niveles** (§10) en escritorio y celular. *Aceptación:* clic o mouse sobre una categoría abre su pestaña sin navegar; "Ver todo" lleva a la rama.

## 12. Pruebas

- Tests unitarios (TDD) de la lógica del árbol: slugs, duplicados, mover sin ciclos, descendientes, migas, caminos de texto y búsqueda sin tildes.
- Tests de la importación con caminos y de la conversión de categorías planas.
- Pruebas reales en el navegador por etapa: admin (crear, renombrar, mover, borrar bloqueado, mover artículos), tienda (rutas, 404, redirección, migas, filtros por rama), menú (mouse, teclado, celular) y medición de rendimiento al terminar.

## 13. Riesgos y mitigaciones

- **Muchos archivos tocados (~40):** los campos `category`/`subCategory` se conservan derivados y se migra por etapas.
- **Pérdida de enlaces y posicionamiento:** redirecciones 308 desde las direcciones viejas.
- **Migración en producción sin acceso mío:** conversión idempotente desde el admin + importación por Excel; verificación de totales antes y después.
- **Rendimiento del encabezado:** el árbol con cantidades se cachea 60 s; se mide después de la etapa 4.
