import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { readCustomerSession, customerLogoutCookies } from "@/lib/customer-auth";
import { CustomerModel } from "@/models/Customer";

export async function GET(request: Request) {
  const customerId = readCustomerSession(request);
  if (!customerId) return NextResponse.json({ authenticated: false }, { status: 200 });
  await connectDb();
  const customer = await CustomerModel.findById(customerId);
  if (!customer) return NextResponse.json({ authenticated: false }, { status: 200 });
  return NextResponse.json({
    authenticated: true,
    customer: {
      id: String(customer._id),
      name: customer.name,
      email: customer.email,
      picture: customer.picture
    }
  });
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  for (const cookie of customerLogoutCookies()) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}
