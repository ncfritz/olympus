/**
 * The console's sign-in through Olympus (ADR 0029) is
 * `@ncfritz/olympus-nest`'s ConsoleSignIn, configured by AuthModule with
 * this console's client id, device name and cookies.
 */
export {
  ConsoleSignIn as SignInService,
  type SignInTransaction,
} from "@ncfritz/olympus-nest";
