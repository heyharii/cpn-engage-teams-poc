/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button, Divider } from "chat";
import type { DailyDrop, DropQuestion } from "@cpn-engage/shared";

/**
 * One question of the daily drop. A drop may have several questions — `qNum`/
 * `total` show progress ("Question 2 of 3"). Options are shown in full as body
 * text with numbered buttons underneath (Teams truncates long button labels).
 */
export function DailyDropCard(opts: { drop: DailyDrop; question: DropQuestion; qNum: number; total: number }) {
  const { drop, question, qNum, total } = opts;
  const progress = total > 1 ? ` · Question ${qNum} of ${total}` : "";
  return (
    <Card
      title={`⚡ ${drop.title}`}
      subtitle={`${drop.behavior} · ${drop.rewardLabel}${progress}`}
    >
      <Section>
        <CardText>{question.question}</CardText>
      </Section>
      <Divider />
      <Section>
        {question.options.map((o, i) => (
          <CardText key={o.id}>{`**${i + 1}.** ${o.label}`}</CardText>
        ))}
      </Section>
      <Divider />
      <Section>
        <CardText>Tap your answer:</CardText>
      </Section>
      <Actions>
        {question.options.map((o, i) => (
          <Button key={o.id} id="submit_answer" value={`${drop.id}|${question.id}|${o.id}`}>
            {String(i + 1)}
          </Button>
        ))}
      </Actions>
    </Card>
  );
}
