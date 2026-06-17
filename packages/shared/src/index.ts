export type Behavior = {
  name: string;
  tagline: string;
};

export type LearningModule = {
  id: string;
  title: string;
  summary: string;
  duration: string;
  status: "assigned" | "completed";
};

export type Challenge = {
  id: string;
  title: string;
  prompt: string;
  behavior: string;
  status: "pending" | "completed";
};

export type DailyDropOption = {
  id: string;
  label: string;
  isBest?: boolean;
};

export type DailyDrop = {
  id: string;
  title: string;
  behavior: string;
  rewardLabel: string;
  timeLimit: string;
  question: string;
  options: DailyDropOption[];
  status: "pending" | "completed";
};

export type CurrentUser = {
  id: string;
  name: string;
  role: string;
  businessUnit: string;
};

export type Stats = {
  progress: number;
  streak: number;
  pendingChallenge: string;
};

export type Metric = {
  label: string;
  value: string;
  note: string;
};

export type LeaderboardEntry = {
  name: string;
  points: number;
};

export type FeedItem = {
  id: string;
  kind: "recognition" | "leaderboard" | "announcement";
  title: string;
  summary: string;
};

export type PassportValueProgress = {
  name: string;
  points: number;
  status: "completed" | "in-progress";
};

export type PassportEntry = {
  id: string;
  title: string;
  behavior: string;
  points: number;
  date: string;
  status: "recorded" | "completed";
};

export type PassportSummary = {
  score: number;
  completion: number;
  modulesCompleted: number;
  modulesTotal: number;
  badges: number;
  valuesProgress: PassportValueProgress[];
  recentEntries: PassportEntry[];
};

export type StreakSummary = {
  current: number;
  best: number;
  nextMilestone: number;
  daysLeft: number;
  reward: string;
};

export type CapstonePreview = {
  title: string;
  summary: string;
  reward: string;
  timeLimit: string;
  difficulty: string;
  unlocked: boolean;
};

export type PersonaSummary = {
  title: string;
  level: number;
  points: number;
  traits: string[];
};

export type RecognitionQueueItem = {
  id: string;
  employee: string;
  target: string;
  behavior: string;
  message: string;
};

export type RecognitionSubmissionInput = {
  employee: string;
  target: string;
  behavior: string;
  message: string;
};

export type NotificationItem = {
  id: string;
  type: "module-assigned" | "challenge-reminder" | "recognition-approved" | "leaderboard-summary";
  title: string;
  summary: string;
  audience: string;
  template?: BotCardTemplate;
};

export type NotificationRequest = {
  type: NotificationItem["type"];
  title: string;
  summary: string;
  audience: string;
  template?: BotCardTemplate;
};

export type BotCardTemplate =
  | "module-assigned"
  | "daily-drop"
  | "streak-risk"
  | "passport-summary"
  | "capstone-unlocked"
  | "recognition-approved";

export type DemoScenarioName =
  | "morning-activation"
  | "recognition-to-feed"
  | "streak-recovery"
  | "capstone-launch";

export type DemoScenario = {
  name: DemoScenarioName;
  title: string;
  description: string;
};

export type Spotlight = {
  title: string;
  summary: string;
};

export type BootstrapResponse = {
  currentUser: CurrentUser;
  stats: Stats;
  modules: LearningModule[];
  challenges: Challenge[];
  dailyDrop: DailyDrop;
  feed: FeedItem[];
  metrics: Metric[];
  behaviors: Behavior[];
  recognitionQueue: RecognitionQueueItem[];
  leaderboard: LeaderboardEntry[];
  notifications: NotificationItem[];
  spotlight: Spotlight;
  passport: PassportSummary;
  streakSummary: StreakSummary;
  capstone: CapstonePreview;
  persona: PersonaSummary;
  publishingDestinations: string[];
};

export const demoBehaviors: Behavior[] = [
  { name: "Customer First", tagline: "Act with service empathy." },
  { name: "One Team", tagline: "Collaborate across functions." },
  { name: "Own It", tagline: "Turn responsibility into action." },
  { name: "Grow Together", tagline: "Share progress generously." }
];

export const demoModules: LearningModule[] = [
  {
    id: "module-1",
    title: "Building Customer Empathy",
    summary: "A short learning journey on listening, context, and service recovery.",
    duration: "15 min",
    status: "assigned"
  },
  {
    id: "module-2",
    title: "Solving With Impact",
    summary: "Scenario practice for decision-making under time pressure.",
    duration: "12 min",
    status: "completed"
  }
];

export const demoChallenges: Challenge[] = [
  {
    id: "challenge-1",
    title: "Customer First Challenge",
    prompt: "How would you respond when a frustrated customer asks for an exception during peak traffic?",
    behavior: "Customer First",
    status: "pending"
  },
  {
    id: "challenge-2",
    title: "One Team Reflection",
    prompt: "Describe one action that helped another store team move faster this week.",
    behavior: "One Team",
    status: "completed"
  }
];

export const demoDailyDrop: DailyDrop = {
  id: "challenge-1",
  title: "Daily Drop Challenge",
  behavior: "Customer First",
  rewardLabel: "Up to 50 points",
  timeLimit: "30 sec",
  question: "A peak-hour tenant escalation is rising. What is the best next step?",
  options: [
    {
      id: "option-1",
      label: "Clarify what the customer needs most urgently and align the team on an immediate recovery move.",
      isBest: true
    },
    {
      id: "option-2",
      label: "Ask the team to follow the standard queue and solve the concern later."
    },
    {
      id: "option-3",
      label: "Escalate straight to senior leadership before understanding the root issue."
    }
  ],
  status: "pending"
};

export const demoCurrentUser: CurrentUser = {
  id: "user-1",
  name: "Narin",
  role: "Store Operations",
  businessUnit: "Retail Operations"
};

export const demoStats: Stats = {
  progress: 75,
  streak: 12,
  pendingChallenge: "Customer First Challenge"
};

export const demoMetrics: Metric[] = [
  { label: "Active users", value: "8,742", note: "72% weekly activity" },
  { label: "Module completion", value: "68%", note: "Current campaign average" },
  { label: "Challenge participation", value: "61%", note: "Across the last 7 days" },
  { label: "Recognition posts", value: "1,892", note: "Public feed volume" }
];

export const demoFeed: FeedItem[] = [
  {
    id: "feed-1",
    kind: "recognition",
    title: "Customer First recognition",
    summary: "Patcharaporn K. recognized Somruk T. for guiding a difficult store recovery."
  },
  {
    id: "feed-2",
    kind: "leaderboard",
    title: "Weekly top performers",
    summary: "Natcha P. leads the week with 560 points."
  },
  {
    id: "feed-3",
    kind: "announcement",
    title: "Final week unlocked",
    summary: "Capstone challenge is now available for employees who have stayed active this month."
  }
];

export const demoRecognitionQueue: RecognitionQueueItem[] = [
  {
    id: "rec-1",
    employee: "Patcharaporn K.",
    target: "Somruk T.",
    behavior: "Customer First",
    message: "Thank you for helping the store navigate a difficult recovery issue with calm and care."
  }
];

export const demoLeaderboard: LeaderboardEntry[] = [
  { name: "Natcha P.", points: 560 },
  { name: "Thanet S.", points: 490 },
  { name: "Apinya K.", points: 460 },
  { name: "You", points: 350 }
];

export const demoNotifications: NotificationItem[] = [
  {
    id: "notif-1",
    type: "module-assigned",
    title: "New learning module assigned",
    summary: "Building Customer Empathy is ready for completion this week.",
    audience: "user-1",
    template: "module-assigned"
  },
  {
    id: "notif-2",
    type: "challenge-reminder",
    title: "Challenge reminder",
    summary: "Customer First Challenge is due in 2 days.",
    audience: "user-1",
    template: "daily-drop"
  },
  {
    id: "notif-3",
    type: "leaderboard-summary",
    title: "Streak at risk",
    summary: "Complete today's daily drop before midnight to protect your 12-day streak.",
    audience: "user-1",
    template: "streak-risk"
  }
];

export const demoSpotlight: Spotlight = {
  title: "Weekly top performers announcement",
  summary: "Generate a clean feed post, keep the custom feed as source of truth, and optionally push it to native Communities."
};

export const demoPassport: PassportSummary = {
  score: 875,
  completion: 75,
  modulesCompleted: 9,
  modulesTotal: 12,
  badges: 6,
  valuesProgress: [
    { name: "Customer First", points: 250, status: "completed" },
    { name: "One Team", points: 175, status: "in-progress" },
    { name: "Own It", points: 225, status: "completed" },
    { name: "Grow Together", points: 225, status: "completed" }
  ],
  recentEntries: [
    {
      id: "passport-1",
      title: "Daily Drop completed",
      behavior: "Customer First",
      points: 50,
      date: "June 17, 2026",
      status: "recorded"
    },
    {
      id: "passport-2",
      title: "Recognition contribution logged",
      behavior: "Grow Together",
      points: 75,
      date: "June 16, 2026",
      status: "recorded"
    },
    {
      id: "passport-3",
      title: "Module milestone completed",
      behavior: "Own It",
      points: 100,
      date: "June 15, 2026",
      status: "completed"
    }
  ]
};

export const demoStreakSummary: StreakSummary = {
  current: 12,
  best: 14,
  nextMilestone: 14,
  daysLeft: 2,
  reward: "1x entry into the monthly prize draw"
};

export const demoCapstone: CapstonePreview = {
  title: "Capstone Challenge",
  summary: "A high-stakes operating scenario that tests judgment, alignment, and customer recovery under pressure.",
  reward: "500 XP + Master badge",
  timeLimit: "05:00",
  difficulty: "Extreme",
  unlocked: true
};

export const demoPersona: PersonaSummary = {
  title: "Customer-Centered Catalyst",
  level: 4,
  points: 1250,
  traits: ["Trusted Aura", "Strategic Vision", "Synergy Core"]
};

export const demoPublishingDestinations = [
  "Teams private notifications or chat",
  "Custom community feed tab",
  "Native Teams Communities via Viva Engage"
];

export const demoScenarios: DemoScenario[] = [
  {
    name: "morning-activation",
    title: "Morning activation",
    description: "Queue the private module and daily drop prompts for an employee's morning kickoff."
  },
  {
    name: "recognition-to-feed",
    title: "Recognition to feed",
    description: "Submit and approve a peer recognition so it lands in the public community feed."
  },
  {
    name: "streak-recovery",
    title: "Streak recovery",
    description: "Trigger a streak-at-risk nudge, then recover momentum and update the passport."
  },
  {
    name: "capstone-launch",
    title: "Capstone launch",
    description: "Unlock the final challenge moment and queue the launch announcement."
  }
];

export const demoBootstrap: BootstrapResponse = {
  currentUser: demoCurrentUser,
  stats: demoStats,
  modules: demoModules,
  challenges: demoChallenges,
  dailyDrop: demoDailyDrop,
  feed: demoFeed,
  metrics: demoMetrics,
  behaviors: demoBehaviors,
  recognitionQueue: demoRecognitionQueue,
  leaderboard: demoLeaderboard,
  notifications: demoNotifications,
  spotlight: demoSpotlight,
  passport: demoPassport,
  streakSummary: demoStreakSummary,
  capstone: demoCapstone,
  persona: demoPersona,
  publishingDestinations: demoPublishingDestinations
};
