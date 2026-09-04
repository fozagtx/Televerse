import { NextResponse } from "next/server";

function billingUnavailable() {
  return NextResponse.json(
    {
      data: null,
      error: {
        message: "Billing is not configured for this deployment",
      },
    },
    { status: 200 },
  );
}

export function GET() {
  return billingUnavailable();
}

export function POST() {
  return billingUnavailable();
}
