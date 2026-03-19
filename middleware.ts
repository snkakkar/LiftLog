import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/",
    "/program/:path*",
    "/workout/:path*",
    "/history/:path*",
    "/profile",
    "/profile/:path*",
    "/admin",
    "/admin/:path*",
    "/import",
    "/api/admin/:path*",
    "/api/programs/:path*",
    "/api/sessions/:path*",
    "/api/log",
    "/api/logged-sets/:path*",
    "/api/profile/:path*",
    "/api/previous-log",
    "/api/import",
    "/api/weeks/:path*",
    "/api/exercises/:path*",
    "/api/workout-day/:path*",
  ],
};
