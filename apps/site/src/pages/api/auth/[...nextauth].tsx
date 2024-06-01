import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";

export const authOptions = {
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
  },
  providers: [
    GithubProvider({
      name: "github",
      clientId: "9cc57312696d4ab27dd8",
      clientSecret: "c2fe2cda861ecf6c7404badb00e2636428d2081c",
    }),
  ],
};
export default NextAuth(authOptions);
