/** @jsxImportSource chat */
import { Card, CardText, Section, Table, Actions, Button, Divider } from "chat";
import type { LeaderboardEntry } from "@cpn-engage/shared";

/**
 * Weekly leaderboard, read live from the shared API so it matches the
 * Community Feed tab. Renders as a native Teams table.
 */
export function LeaderboardCard(opts: { entries: LeaderboardEntry[]; you?: string }) {
  const top = opts.entries.slice(0, 5);
  const rows: string[][] = top.map((e, i) => [
    `#${i + 1}`,
    opts.you && e.name === opts.you ? `${e.name} (You)` : e.name,
    `${e.points} pts`
  ]);

  return (
    <Card title="🏆 Weekly Leaderboard · Updated today" subtitle="Top performers across CPN behaviours">
      <Section>
        <CardText>Here's how the momentum board looks right now.</CardText>
      </Section>
      <Divider />
      <Table headers={["#", "Colleague", "Score"]} rows={rows} align={["left", "left", "right"]} />
      <Divider />
      <Section>
        <CardText>Complete today's daily drop to climb before the weekly reset.</CardText>
      </Section>
      <Actions>
        <Button id="intent" value="daily_challenge" style="primary">
          Daily drop
        </Button>
        <Button id="intent" value="help">Back to menu</Button>
      </Actions>
    </Card>
  );
}
