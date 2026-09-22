import { NextRequest, NextResponse } from "next/server";

const LOGIN_PATH = "/mgmt-portal-x7k9";
const DASHBOARD_PATH = `${LOGIN_PATH}/dashboard`;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get("rival_admin_session")?.value);

  if (pathname.startsWith(DASHBOARD_PATH) && !hasSession) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === LOGIN_PATH && hasSession) {
    return NextResponse.redirect(new URL(DASHBOARD_PATH, request.url));
  }

  const response = NextResponse.next();
  if (pathname.startsWith(LOGIN_PATH)) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/mgmt-portal-x7k9/:path*"],
};
