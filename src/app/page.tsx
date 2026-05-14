import { connection } from "next/server";
import { redirect } from "next/navigation";

export default async function Home() {
  await connection();
  redirect("/immersive");
}
