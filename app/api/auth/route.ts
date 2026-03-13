import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (password === process.env.DASHBOARD_PASSWORD) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set("m51_auth", process.env.DASHBOARD_PASSWORD!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 dager
      path: "/",
    });
    return response;
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
