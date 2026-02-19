import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { returnTo?: string };
}) {
  return <LoginClient returnTo={searchParams.returnTo} />;
}
