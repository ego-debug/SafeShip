import { SignIn } from "@clerk/nextjs";
import { Background } from "@/components/Background";

export default function SignInPage() {
  return (
    <>
      <Background />
      <main className="relative z-[1] grid min-h-screen place-items-center px-6">
        <SignIn signUpUrl="/sign-up" forceRedirectUrl="/app/onboarding" />
      </main>
    </>
  );
}
