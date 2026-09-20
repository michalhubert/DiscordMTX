import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth?.user;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");
  const isAuthApi = req.nextUrl.pathname.startsWith("/api/auth");
  const isDockArea =
    req.nextUrl.pathname.startsWith("/dock") ||
    req.nextUrl.pathname.startsWith("/api/mediamtx") ||
    req.nextUrl.pathname.startsWith("/api/dock");

  if (!isLoggedIn && !isLoginPage && !isAuthApi) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    loginUrl.searchParams.set("originUrl", req.nextUrl.origin);
    if (isDockArea) loginUrl.searchParams.set("mode", "streamer");
    return Response.redirect(loginUrl);
  }

  const role = (req.auth?.user as { role?: string } | undefined)?.role;
  if (isDockArea && isLoggedIn && role !== "streamer") {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    loginUrl.searchParams.set("originUrl", req.nextUrl.origin);
    loginUrl.searchParams.set("mode", "streamer");
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
