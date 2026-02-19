import LoginClient from "./LoginClient";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { returnTo?: string };
}) {
  return <LoginClient returnTo={searchParams.returnTo} />;
}
