import { authenticate, failure } from "@/lib/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { db } = await authenticate(request);
    const raw = await request.text();
    if (raw.length > 20000)
      return Response.json({ error: "Request too large." }, { status: 413 });
    let body: {
      action?: string;
      setId?: string;
      index?: number;
      choice?: number;
      choices?: number[];
    };
    try {
      body = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Invalid JSON." }, { status: 400 });
    }
    if (!body.setId)
      return Response.json({ error: "Choose a saved study set." }, { status: 400 });
    if (body.action === "practice") {
      const result = await db.rpc("practice_feedback", {
        set_id: body.setId,
        item_index: body.index,
        choice: body.choice,
      });
      if (result.error)
        return Response.json(
          { error: "That answer could not be checked." },
          { status: 400 },
        );
      return Response.json(result.data);
    }
    if (body.action === "grade") {
      const result = await db.rpc("grade_quiz", {
        set_id: body.setId,
        choices: body.choices ?? [],
      });
      if (result.error)
        return Response.json(
          { error: "Finish every question before submitting." },
          { status: 400 },
        );
      return Response.json(result.data);
    }
    return Response.json({ error: "Choose a study action." }, { status: 400 });
  } catch (error) {
    return failure(error);
  }
}
