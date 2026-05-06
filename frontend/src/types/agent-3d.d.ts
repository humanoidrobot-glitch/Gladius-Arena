// JSX type declaration for the three.ws <agent-3d> custom element so
// React/TypeScript stops complaining and prop name autocomplete works.
//
// The full attribute set lives at https://three.ws/docs — only the
// ones Gladius actually uses are listed here. Attribute names match
// the kebab-case HTML form (agent-id, chain-id) which React forwards
// to the DOM as-is.

import type { DetailedHTMLProps, HTMLAttributes } from "react";

type AgentThreeDAttrs = {
  "agent-id"?: string;
  body?: string;
  "chain-id"?: string;
  brain?: string;
  width?: string | number;
  height?: string | number;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "agent-3d": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & AgentThreeDAttrs,
        HTMLElement
      >;
    }
  }
}

// Imperatively-callable methods three.ws exposes on the element.
// Documented at https://three.ws/docs/web-component/api.
export interface AgentThreeDElement extends HTMLElement {
  expressEmotion?: (
    trigger: "celebration" | "concern" | "curiosity" | "empathy" | "patience",
    weight?: number,
  ) => void;
}

export {};
