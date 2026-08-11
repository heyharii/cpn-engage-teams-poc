/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button, Divider } from "chat";

/**
 * The one card that navigates. Every other card either advances a flow or
 * carries a single button back here — so no card in the scrollback can start
 * (or restart) a flow behind the user's back.
 *
 * When a flow is in progress the hub leads with Continue, which is also the
 * only way back into a paused flow.
 */
export function HubCard(
  opts: {
    displayName?: string;
    resume?: { label: string; detail: string } | null;
    /** v2 flows on offer. They sit ALONGSIDE their v1 buttons, never replacing
     *  them, so both versions can be tried in the same conversation. */
    v2?: { intent: string; label: string }[];
  } = {}
) {
  const hi = opts.displayName ? `Hi ${opts.displayName}!` : "Hi!";
  const r = opts.resume;
  const v2 = opts.v2 ?? [];
  return (
    <Card title="👋 CPN Engage" subtitle="Your Central Pattana culture companion">
      <Section>
        <CardText>
          {hi} I help you grow the four CPN Beliefs through short learning modules,
          quick challenges, and peer recognition.
        </CardText>
      </Section>
      {r ? (
        <>
          <Divider />
          <Section>
            <CardText style="bold">IN PROGRESS</CardText>
            <CardText>{`${r.label} — ${r.detail}`}</CardText>
          </Section>
        </>
      ) : null}
      <Divider />
      <Section>
        <CardText style="bold">What would you like to do?</CardText>
      </Section>
      <Actions>
        {r ? (
          <Button id="resume" value="resume" style="primary">
            Continue
          </Button>
        ) : null}
        <Button id="intent" value="browse_modules" style={r ? undefined : "primary"}>
          Browse modules
        </Button>
        <Button id="intent" value="daily_challenge">Today's challenge</Button>
        <Button id="intent" value="recognise">Recognise a colleague</Button>
        <Button id="intent" value="leaderboard">View leaderboard</Button>
        {v2.map((f) => (
          <Button key={f.intent} id="intent" value={f.intent}>
            {f.label}
          </Button>
        ))}
      </Actions>
    </Card>
  );
}
