/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button, Divider } from "chat";

/** Proactive: a new learning module has been assigned. */
export function ModuleAssignedCard(opts: { moduleId: string; title: string; track: string; durationMin: number }) {
  return (
    <Card title="📘 New module assigned" subtitle={`${opts.track} · ${opts.durationMin} min`}>
      <Section>
        <CardText style="bold">{opts.title}</CardText>
        <CardText>Tap below to start — it only takes a few minutes.</CardText>
      </Section>
      <Actions>
        <Button id="start_module" value={opts.moduleId} style="primary">
          Start module
        </Button>
        <Button id="remind_later" value={opts.moduleId}>Remind me later</Button>
      </Actions>
    </Card>
  );
}

/** Proactive: a scheduled challenge is ready (Challenges feature). */
export function ChallengeReminderCard(opts: { behavior: string; reward: string; timeLimit: string }) {
  return (
    <Card title="⚡ Today's challenge is ready" subtitle={`${opts.behavior} · ${opts.reward}`}>
      <Section>
        <CardText>{`A quick ${opts.timeLimit} scenario — answer correctly to earn points and climb the leaderboard.`}</CardText>
      </Section>
      <Actions>
        <Button id="intent" value="daily_challenge" style="primary">
          Answer now
        </Button>
      </Actions>
    </Card>
  );
}

/** Proactive: a module or challenge is approaching its deadline. */
export function DeadlineReminderCard(opts: { title: string; daysLeft: number; actionId: string; actionValue: string }) {
  return (
    <Card title="⏰ Deadline approaching" subtitle={`${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"} left`}>
      <Section>
        <CardText style="bold">{opts.title}</CardText>
        <CardText>Complete it before it closes so it still counts.</CardText>
      </Section>
      <Divider />
      <Actions>
        <Button id={opts.actionId} value={opts.actionValue} style="primary">
          Finish it now
        </Button>
      </Actions>
    </Card>
  );
}
