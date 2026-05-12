import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Background } from "@/components/Background";
import { AppNav } from "@/components/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  return (
    <>
      <Background />
      <div className="relative z-[1] mx-auto max-w-shell px-8">
        <AppNav />
        {children}
      </div>
    </>
  );
}
