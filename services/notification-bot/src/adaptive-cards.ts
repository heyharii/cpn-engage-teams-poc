import {
  demoBootstrap,
  type BotCardTemplate,
  type NotificationItem,
  type NotificationRequest
} from "@cpn-engage/shared";

type AdaptiveCard = {
  $schema: string;
  type: "AdaptiveCard";
  version: string;
  body: Record<string, unknown>[];
  actions?: Record<string, unknown>[];
  msteams?: Record<string, unknown>;
};

type MessageEnvelope = {
  type: "message";
  summary: string;
  attachments: Array<{
    contentType: "application/vnd.microsoft.card.adaptive";
    content: AdaptiveCard;
  }>;
};

type TemplatePreview = {
  template: BotCardTemplate;
  title: string;
  description: string;
};

const templatePreviews: TemplatePreview[] = [
  {
    template: "module-assigned",
    title: "Module assigned",
    description: "Private Teams prompt for a new learning module with a start action."
  },
  {
    template: "daily-drop",
    title: "Daily drop",
    description: "Timed challenge card with answer options and a quick CTA."
  },
  {
    template: "streak-risk",
    title: "Streak at risk",
    description: "Urgent reminder to complete today's action before midnight."
  },
  {
    template: "passport-summary",
    title: "Passport summary",
    description: "Progress summary showing score, completion, and recent momentum."
  },
  {
    template: "capstone-unlocked",
    title: "Capstone unlocked",
    description: "High-energy unlock moment for the final challenge."
  },
  {
    template: "recognition-approved",
    title: "Recognition approved",
    description: "Celebration card when a recognition moves into the public feed."
  }
];

function createCard(body: Record<string, unknown>[], actions?: Record<string, unknown>[]): AdaptiveCard {
  return {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.4",
    body,
    actions,
    msteams: {
      width: "Full"
    }
  };
}

function createMessage(summary: string, card: AdaptiveCard): MessageEnvelope {
  return {
    type: "message",
    summary,
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: card
      }
    ]
  };
}

function moduleAssignedCard() {
  const module = demoBootstrap.modules[0];

  return createMessage(
    "New learning module assigned",
    createCard(
      [
        {
          type: "TextBlock",
          text: "New Module Available",
          weight: "Bolder",
          color: "Attention",
          size: "Medium"
        },
        {
          type: "TextBlock",
          text: module.title,
          wrap: true,
          weight: "Bolder",
          size: "Large"
        },
        {
          type: "TextBlock",
          text: module.summary,
          wrap: true,
          spacing: "Small"
        },
        {
          type: "FactSet",
          facts: [
            { title: "Duration", value: module.duration },
            { title: "Behavior", value: demoBootstrap.behaviors[0]?.name ?? "Behavior" },
            { title: "Format", value: "Video, guide, quick quiz" }
          ]
        }
      ],
      [
        {
          type: "Action.Submit",
          title: "Start module",
          data: { action: "start-module", moduleId: module.id }
        },
        {
          type: "Action.Submit",
          title: "Remind me later",
          data: { action: "remind-module", moduleId: module.id }
        }
      ]
    )
  );
}

function dailyDropCard() {
  const drop = demoBootstrap.dailyDrop;

  return createMessage(
    "Daily drop challenge",
    createCard(
      [
        {
          type: "ColumnSet",
          columns: [
            {
              type: "Column",
              width: "stretch",
              items: [
                {
                  type: "TextBlock",
                  text: drop.title,
                  weight: "Bolder",
                  size: "Large",
                  color: "Accent"
                }
              ]
            },
            {
              type: "Column",
              width: "auto",
              items: [
                {
                  type: "TextBlock",
                  text: drop.timeLimit,
                  color: "Attention",
                  weight: "Bolder"
                }
              ]
            }
          ]
        },
        {
          type: "TextBlock",
          text: `${drop.behavior} • ${drop.rewardLabel}`,
          isSubtle: true,
          spacing: "Small"
        },
        {
          type: "TextBlock",
          text: drop.question,
          wrap: true,
          weight: "Bolder",
          spacing: "Medium"
        },
        {
          type: "Input.ChoiceSet",
          id: "dailyDropAnswer",
          style: "expanded",
          choices: drop.options.map((option) => ({
            title: option.label,
            value: option.id
          }))
        }
      ],
      [
        {
          type: "Action.Submit",
          title: "Submit answer",
          data: { action: "submit-daily-drop", challengeId: drop.id }
        }
      ]
    )
  );
}

function streakRiskCard() {
  const streak = demoBootstrap.streakSummary;

  return createMessage(
    "Streak at risk",
    createCard(
      [
        {
          type: "TextBlock",
          text: "Action Required: Streak at Risk",
          weight: "Bolder",
          color: "Warning",
          size: "Medium"
        },
        {
          type: "TextBlock",
          text: `You have not completed today's daily drop yet. Protect your ${streak.current}-day streak before midnight.`,
          wrap: true
        },
        {
          type: "FactSet",
          facts: [
            { title: "Current streak", value: `${streak.current} days` },
            { title: "Next milestone", value: `${streak.nextMilestone} days` },
            { title: "Reward", value: streak.reward }
          ]
        }
      ],
      [
        {
          type: "Action.Submit",
          title: "Complete today's challenge",
          data: { action: "resume-daily-drop", challengeId: demoBootstrap.dailyDrop.id }
        }
      ]
    )
  );
}

function passportSummaryCard() {
  const passport = demoBootstrap.passport;

  return createMessage(
    "Passport updated",
    createCard(
      [
        {
          type: "TextBlock",
          text: "SIAM Progress Passport",
          weight: "Bolder",
          size: "Large",
          color: "Attention"
        },
        {
          type: "TextBlock",
          text: "Your learning record across the journey",
          isSubtle: true,
          spacing: "Small"
        },
        {
          type: "FactSet",
          facts: [
            { title: "Score", value: `${passport.score}` },
            { title: "Completion", value: `${passport.completion}%` },
            { title: "Modules", value: `${passport.modulesCompleted}/${passport.modulesTotal}` },
            { title: "Badges", value: `${passport.badges}` }
          ]
        },
        {
          type: "TextBlock",
          text: "Recent entries",
          weight: "Bolder",
          spacing: "Medium"
        },
        {
          type: "Container",
          items: passport.recentEntries.slice(0, 3).map((entry) => ({
            type: "TextBlock",
            text: `${entry.title} • +${entry.points} pts`,
            wrap: true,
            spacing: "Small"
          }))
        }
      ],
      [
        {
          type: "Action.Submit",
          title: "View passport",
          data: { action: "view-passport" }
        },
        {
          type: "Action.Submit",
          title: "Share progress",
          data: { action: "share-passport" }
        }
      ]
    )
  );
}

function capstoneUnlockedCard() {
  const capstone = demoBootstrap.capstone;

  return createMessage(
    "Capstone unlocked",
    createCard(
      [
        {
          type: "TextBlock",
          text: "Final Week Unlocked",
          weight: "Bolder",
          color: "Attention",
          size: "Medium"
        },
        {
          type: "TextBlock",
          text: capstone.title,
          wrap: true,
          weight: "Bolder",
          size: "Large"
        },
        {
          type: "TextBlock",
          text: capstone.summary,
          wrap: true
        },
        {
          type: "FactSet",
          facts: [
            { title: "Time limit", value: capstone.timeLimit },
            { title: "Difficulty", value: capstone.difficulty },
            { title: "Reward", value: capstone.reward }
          ]
        }
      ],
      [
        {
          type: "Action.Submit",
          title: "Start challenge",
          data: { action: "start-capstone" }
        }
      ]
    )
  );
}

function recognitionApprovedCard() {
  const queueItem = demoBootstrap.recognitionQueue[0];

  return createMessage(
    "Recognition approved",
    createCard(
      [
        {
          type: "TextBlock",
          text: "Recognition Approved",
          weight: "Bolder",
          color: "Good",
          size: "Medium"
        },
        {
          type: "TextBlock",
          text: `${queueItem.target} is now featured in the community feed.`,
          wrap: true,
          weight: "Bolder"
        },
        {
          type: "TextBlock",
          text: queueItem.message,
          wrap: true
        },
        {
          type: "FactSet",
          facts: [
            { title: "Submitted by", value: queueItem.employee },
            { title: "Behavior", value: queueItem.behavior },
            { title: "Destination", value: "Custom community feed" }
          ]
        }
      ],
      [
        {
          type: "Action.Submit",
          title: "View public post",
          data: { action: "view-recognition-feed" }
        }
      ]
    )
  );
}

export function listCardTemplates() {
  return templatePreviews;
}

export function resolveTemplateFromNotification(input: NotificationRequest | NotificationItem): BotCardTemplate {
  if (input.template) {
    return input.template;
  }

  switch (input.type) {
    case "module-assigned":
      return "module-assigned";
    case "challenge-reminder":
      return "daily-drop";
    case "recognition-approved":
      return "recognition-approved";
    case "leaderboard-summary":
      return "passport-summary";
    default:
      return "module-assigned";
  }
}

export function buildTemplateMessage(template: BotCardTemplate): MessageEnvelope {
  switch (template) {
    case "module-assigned":
      return moduleAssignedCard();
    case "daily-drop":
      return dailyDropCard();
    case "streak-risk":
      return streakRiskCard();
    case "passport-summary":
      return passportSummaryCard();
    case "capstone-unlocked":
      return capstoneUnlockedCard();
    case "recognition-approved":
      return recognitionApprovedCard();
  }
}
