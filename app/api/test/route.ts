// Simple test endpoint to verify server is working
import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ status: "ok", message: "Server is running" })
}
