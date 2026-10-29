import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { readCustomerSession } from "@/lib/customer-auth";
import { OrderModel } from "@/models/Order";

export async function GET(request: Request) {
  const customerId = readCustomerSession(request);
  if (!customerId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  await connectDb();
  const orders = await OrderModel.find({ customerId }).sort({ createdAt: -1 }).lean();
  return NextResponse.json(orders.map(({ _id, ...order }) => ({ ...order, id: String(_id) })));
}
