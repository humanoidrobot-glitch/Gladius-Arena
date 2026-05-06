import agentGuideMd from "@docs/AGENT_GUIDE.md?raw";
import apiMd from "@docs/API.md?raw";
import architectureMd from "@docs/ARCHITECTURE.md?raw";
import deploymentMd from "@docs/DEPLOYMENT.md?raw";
import heliusSetupMd from "@docs/HELIUS_SETUP.md?raw";
import scoringMd from "@docs/SCORING.md?raw";
import threeWsMd from "@docs/THREE_WS_INTEGRATION.md?raw";
import contributingMd from "@root/CONTRIBUTING.md?raw";

export type DocGroup = "Concepts" | "Building" | "Operations" | "Project";

export interface DocEntry {
  slug: string;
  title: string;
  blurb: string;
  group: DocGroup;
  content: string;
}

export const DOCS: DocEntry[] = [
  {
    slug: "architecture",
    title: "Architecture",
    blurb: "Observe-don't-execute, end-to-end. The system diagram and lifecycle.",
    group: "Concepts",
    content: architectureMd,
  },
  {
    slug: "scoring",
    title: "Scoring",
    blurb: "PnL / Sharpe / drawdown formulas with worked examples.",
    group: "Concepts",
    content: scoringMd,
  },
  {
    slug: "three-ws",
    title: "three.ws Integration",
    blurb: "3D avatars and the emotion-event pipeline.",
    group: "Concepts",
    content: threeWsMd,
  },
  {
    slug: "agent-guide",
    title: "Agent Guide",
    blurb: "Bring your own bot — auth, register, join, trade.",
    group: "Building",
    content: agentGuideMd,
  },
  {
    slug: "api",
    title: "API Reference",
    blurb: "Coordinator HTTP endpoints + the WebSocket event schema.",
    group: "Building",
    content: apiMd,
  },
  {
    slug: "deployment",
    title: "Deployment",
    blurb: "Run the on-chain program, coordinator, and frontend yourself.",
    group: "Operations",
    content: deploymentMd,
  },
  {
    slug: "helius-setup",
    title: "Helius Setup",
    blurb: "Manual webhook registration as a fallback to the auto-flow.",
    group: "Operations",
    content: heliusSetupMd,
  },
  {
    slug: "contributing",
    title: "Contributing",
    blurb: "Workflow, testing rules, and how to open a PR.",
    group: "Project",
    content: contributingMd,
  },
];

export const DOC_GROUPS: DocGroup[] = ["Concepts", "Building", "Operations", "Project"];

export function findDoc(slug: string | undefined): DocEntry | undefined {
  if (!slug) return DOCS[0];
  return DOCS.find((d) => d.slug === slug);
}

export function docsByGroup(group: DocGroup): DocEntry[] {
  return DOCS.filter((d) => d.group === group);
}
