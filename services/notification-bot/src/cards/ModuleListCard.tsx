/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button, Divider } from "chat";
import type { ModuleContent } from "./types.ts";

/**
 * Browse the whole learning path and pick what to work on — the bot is no
 * longer limited to one linear "today's module".
 *
 * This card is permanent: it keeps every button live in the scrollback forever.
 * So `pick_module` only OPENS a module's intro — it touches no state. The
 * destructive action stays behind the intro's Start button, which is guarded.
 */
const MAX_BUTTONS = 6;

export function ModuleListCard(opts: { modules: ModuleContent[]; activeId?: string }) {
  const shown = opts.modules.slice(0, MAX_BUTTONS);
  const hidden = opts.modules.length - shown.length;
  return (
    <Card title="📚 Learning path" subtitle={`${opts.modules.length} module(s) available`}>
      <Section>
        {shown.map((m) => (
          <CardText key={m.id}>
            {`${m.id === opts.activeId ? "▶️" : "•"} **${m.title}** — ${m.track} · ${m.durationMin} min`}
          </CardText>
        ))}
      </Section>
      {hidden > 0 ? (
        <Section>
          <CardText>{`+ ${hidden} more — ask me for a module by name.`}</CardText>
        </Section>
      ) : null}
      <Divider />
      <Section>
        <CardText>Pick one to see what's inside:</CardText>
      </Section>
      <Actions>
        {shown.map((m) => (
          <Button key={m.id} id="pick_module" value={m.id}>
            {m.title}
          </Button>
        ))}
      </Actions>
    </Card>
  );
}
