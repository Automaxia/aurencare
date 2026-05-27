import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /**
     * Protege tudo exceto:
     *  - /login (tela de autenticação)
     *  - /api/auth/* (handlers do NextAuth)
     *  - assets estáticos do Next
     *  - favicon
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
