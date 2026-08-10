/**
 * Beliefs (the CPN core values) — authorable, not hardcoded. These are the
 * single source of truth for: the employee "four behaviours" panel, and the
 * Belief dropdown in the module + daily-drop editors. Admins add/edit/reorder;
 * everything else reads this list. Seeds the demo beliefs on first run.
 */
import { demoBehaviors, type Behavior } from "@cpn-engage/shared";
import { sql } from "./db.js";

export const beliefsEnabled = Boolean(sql);

export type Belief = { id: string; name: string; tagline: string; orderIdx: number };

export async function initBeliefs(): Promise<void> {
  if (!sql) {
    console.log("[beliefs] no DATABASE_URL — using in-memory demo beliefs");
    return;
  }
  await sql`
    create table if not exists beliefs (
      id text primary key,
      name text not null,
      tagline text,
      order_idx integer not null default 0,
      updated_at timestamptz not null default now()
    )
  `;
  const n = await sql`select count(*)::int as n from beliefs`;
  if (n[0].n === 0) {
    let i = 0;
    for (const b of demoBehaviors) {
      await upsertBelief({ id: `belief-${b.name.toLowerCase()}`, name: b.name, tagline: b.tagline, orderIdx: i++ });
    }
    console.log(`[beliefs] seeded ${demoBehaviors.length} starter beliefs`);
  }
  console.log("[beliefs] connected + beliefs table ready");
}

export async function listBeliefs(): Promise<Belief[]> {
  if (!sql) return demoBehaviors.map((b, i) => ({ id: `belief-${i}`, name: b.name, tagline: b.tagline, orderIdx: i }));
  const rows = await sql`select id, name, tagline, order_idx as "orderIdx" from beliefs order by order_idx asc, name asc`;
  return rows.map((r) => r as unknown as Belief);
}

/** The shape the employee Profile expects (name + tagline). */
export async function listBehaviors(): Promise<Behavior[]> {
  return (await listBeliefs()).map((b) => ({ name: b.name, tagline: b.tagline }));
}

export async function upsertBelief(b: Belief): Promise<Belief> {
  if (!sql) return b;
  await sql`
    insert into beliefs (id, name, tagline, order_idx, updated_at)
    values (${b.id}, ${b.name}, ${b.tagline ?? null}, ${b.orderIdx ?? 0}, now())
    on conflict (id) do update set
      name = excluded.name, tagline = excluded.tagline, order_idx = excluded.order_idx, updated_at = now()
  `;
  return b;
}

export async function deleteBelief(id: string): Promise<void> {
  if (!sql) return;
  await sql`delete from beliefs where id = ${id}`;
}
