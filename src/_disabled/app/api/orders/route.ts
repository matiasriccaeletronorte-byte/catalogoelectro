import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { OrderModel } from "@/models/Order";
import { ProductModel } from "@/models/Product";
import { CustomerModel } from "@/models/Customer";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { readCustomerSession } from "@/lib/customer-auth";

const orderSchema = z.object({
  customer: z.object({
    phone: z.string().min(6),
    address: z.string().min(5)
  }),
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive() })).min(1)
});

async function adjustStock(items: Array<{ productId: string; quantity: number }>, direction: "deduct" | "restore") {
  const applied: Array<{ productId: string; quantity: number }> = [];
  try {
    for (const item of items) {
      const updated = await ProductModel.updateOne(
        direction === "deduct"
          ? { _id: item.productId, stock: { $gte: item.quantity } }
          : { _id: item.productId },
        direction === "deduct"
          ? { $inc: { stock: -item.quantity } }
          : { $inc: { stock: item.quantity } }
      );
      if (updated.modifiedCount !== 1) {
        throw new Error("stock-unavailable");
      }
      applied.push(item);
    }
  } catch (error) {
    if (direction === "deduct" && applied.length > 0) {
      for (const item of applied) {
        await ProductModel.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
      }
    }
    throw error;
  }
}

const inventoryDeductionEnabled = process.env.INVENTORY_DEDUCTION_ENABLED === "true";

export async function POST(request: Request) {
  const customerId = readCustomerSession(request);
  if (!customerId) return NextResponse.json({ error: "Debés iniciar sesión con Google para comprar." }, { status: 401 });

  const data = orderSchema.safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: "Revisá los datos del pedido." }, { status: 400 });

  await connectDb();
  const customer = await CustomerModel.findById(customerId);
  if (!customer) return NextResponse.json({ error: "Tu sesión de cliente expiró." }, { status: 401 });

  const productIds = [...new Set(data.data.items.map(item => item.productId))];
  const products = await ProductModel.find({ _id: { $in: productIds } }).lean();
  if (products.length !== productIds.length) {
    return NextResponse.json({ error: "Uno o más productos ya no están disponibles." }, { status: 409 });
  }

  const productsById = new Map(products.map(product => [String(product._id), product]));
  const items = data.data.items.map(item => {
    const product = productsById.get(item.productId);
    if (!product) throw new Error("missing-product");
    return {
      productId: item.productId,
      name: product.name,
      price: product.price,
      quantity: item.quantity
    };
  });

  let stockReserved = false;
  try {
    if (inventoryDeductionEnabled) {
      await adjustStock(items.map((item) => ({ productId: item.productId, quantity: item.quantity })), "deduct");
      stockReserved = true;
    }
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order = await OrderModel.create({
      customerId,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: data.data.customer.phone,
        address: data.data.customer.address
      },
      items,
      total,
      inventoryState: inventoryDeductionEnabled ? "deducted" : "none"
    });
    return NextResponse.json({ id: String(order._id), status: order.status }, { status: 201 });
  } catch {
    if (stockReserved) await adjustStock(items.map((item) => ({ productId: item.productId, quantity: item.quantity })), "restore");
    return NextResponse.json({ error: "No se pudo validar el stock del pedido." }, { status: 409 });
  }
}

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  const orders = await OrderModel.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json(orders.map(({ _id, ...order }) => ({ ...order, id: String(_id) })));
}

export async function PATCH(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const { id, status } = await request.json();
  const allowedStatuses = ["pending_review", "approved", "paid", "shipped", "cancelled"] as const;
  if (!id || !allowedStatuses.includes(status)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });

  await connectDb();
  const order = await OrderModel.findById(id);
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  const previousStatus = order.status;
  const nextStatus = status as typeof order.status;

  try {
    const orderItems = order.items as Array<{ productId: string; quantity: number }>;
    if (inventoryDeductionEnabled && nextStatus === "cancelled" && order.inventoryState === "deducted") {
      await adjustStock(orderItems.map((item: { productId: string; quantity: number }) => ({ productId: item.productId, quantity: item.quantity })), "restore");
      order.inventoryState = "none";
    } else if (inventoryDeductionEnabled && nextStatus !== "cancelled" && order.inventoryState !== "deducted") {
      await adjustStock(orderItems.map((item: { productId: string; quantity: number }) => ({ productId: item.productId, quantity: item.quantity })), "deduct");
      order.inventoryState = "deducted";
    }

    order.status = nextStatus;
    await order.save();
    return NextResponse.json({ id, status: nextStatus });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el stock del pedido." }, { status: 409 });
  }
}
