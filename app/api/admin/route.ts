import { authenticate, failure } from "@/lib/server";
export async function GET(request: Request) {
  try {
    const { db } = await authenticate(request);
    const { data: admin } = await db.rpc("is_admin");
    if (!admin)
      return Response.json(
        { error: "Administrator access required." },
        { status: 403 },
      );
    const [people, pending, memberships] = await Promise.all([
      db.from("profiles").select("*"),
      db.from("resources").select("*").neq("visibility", "private"),
      db.from("memberships").select("*"),
    ]);
    if (people.error || pending.error || memberships.error)
      throw new Error("DB");
    return Response.json({
      people: people.data,
      resources: pending.data,
      memberships: memberships.data,
    });
  } catch (error) {
    return failure(error);
  }
}
