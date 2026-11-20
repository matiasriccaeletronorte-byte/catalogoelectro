import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import {
  CategoryError, convertLegacy, countsByNode, createNode, deleteNode, deleteProductsInBranch, legacyProductCount, loadNodes, moveNode, moveProducts, renameNode
} from "@/lib/category-store";
import { connectDb } from "@/lib/db";

const id = z.string().regex(/^[a-f0-9]{24}$/);
const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), parentId: id.nullable(), name: z.string() }),
  z.object({ action: z.literal("rename"), id, name: z.string() }),
  z.object({ action: z.literal("move"), id, newParentId: id.nullable() }),
  z.object({ action: z.literal("move-products"), fromId: id, toId: id }),
  z.object({ action: z.literal("convert") }),
  z.object({ action: z.literal("delete-products"), id, confirm: z.literal("BORRAR") })
]);

const STATUS: Record<CategoryError["code"], number> = { invalid: 400, cycle: 400, not_found: 404, duplicate: 409, has_children: 409, has_products: 409 };

function failure(error: unknown) {
  if (error instanceof CategoryError) return NextResponse.json({ error: error.message }, { status: STATUS[error.code] });
  throw error;
}

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  const [nodes, counts, legacyProducts] = await Promise.all([loadNodes(), countsByNode(true), legacyProductCount()]);
  return NextResponse.json({ nodes, counts, legacyProducts });
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = action.safeParse(await request.json().catch(() => null));
  if (!data.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  await connectDb();
  try {
    const body = data.data;
    let result: unknown = { ok: true };
    if (body.action === "create") result = await createNode(body.parentId, body.name);
    else if (body.action === "rename") await renameNode(body.id, body.name);
    else if (body.action === "move") await moveNode(body.id, body.newParentId);
    else if (body.action === "move-products") result = { moved: await moveProducts(body.fromId, body.toId) };
    else if (body.action === "delete-products") result = { deleted: await deleteProductsInBranch(body.id) };
    else result = await convertLegacy();
    revalidateTag("category-tree");
    return NextResponse.json(result);
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = z.object({ id }).safeParse(await request.json().catch(() => null));
  if (!data.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  await connectDb();
  try {
    await deleteNode(data.data.id);
    revalidateTag("category-tree");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
