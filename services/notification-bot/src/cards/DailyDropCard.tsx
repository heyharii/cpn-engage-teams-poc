/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button, Divider } from "chat";
import type { DailyDrop } from "@cpn-engage/shared";

/**
 * The daily drop question. Options are shown in full as body text, with
 * numbered buttons underneath (Teams truncates long button labels).
 */
export function DailyDropCard(opts: { drop: DailyDrop }) {
  const { drop } = opts;
  return (
    <Card
      title={`⚡ ${drop.title} · ⏱️ ${drop.timeLimit}`}
      subtitle={`${drop.behavior} · ${drop.rewardLabel}`}
    >
      <Section>
        <CardText>{drop.question}</CardText>
      </Section>
      <Divider />
      <Section>
        {drop.options.map((o, i) => (
          <CardText key={o.id}>{`**${i + 1}.** ${o.label}`}</CardText>
        ))}
      </Section>
      <Divider />
      <Section>
        <CardText>Tap your answer:</CardText>
      </Section>
      <Actions>
        {drop.options.map((o, i) => (
          <Button key={o.id} id="submit_answer" value={`${drop.id}|${o.id}`}>
            {String(i + 1)}
          </Button>
        ))}
      </Actions>
    </Card>
  );
}
