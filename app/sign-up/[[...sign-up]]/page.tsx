import { SignUp } from "@clerk/nextjs";
import { Background } from "@/components/Background";

export default function SignUpPage() {
  return (
    <>
      <Background />
      <main className="relative z-[1] grid min-h-screen place-items-center px-6">
        <SignUp signInUrl="/sign-in" forceRedirectUrl="/app/onboarding" />
      </main>
    </>
  );
}
