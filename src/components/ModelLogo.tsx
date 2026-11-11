import React from "react";

export type ModelProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "glm"
  | "xai"
  | "meta"
  | "mistral"
  | "qwen"
  | "unknown";

export interface ProviderMeta {
  id: ModelProvider;
  label: string;
  color: string;
  bg: string;
  border: string;
}

export function detectProvider(modelName: string): ProviderMeta {
  const m = modelName.toLowerCase();

  if (m.includes("gpt") || m.includes("o1") || m.includes("o3") || m.includes("o4") || m.includes("openai")) {
    return {
      id: "openai",
      label: "OpenAI",
      color: "#10a37f",
      bg: "rgba(16, 163, 127, 0.14)",
      border: "rgba(16, 163, 127, 0.32)",
    };
  }
  if (m.includes("claude") || m.includes("anthropic") || m.includes("sonnet") || m.includes("opus") || m.includes("haiku")) {
    return {
      id: "anthropic",
      label: "Anthropic",
      color: "#d97757",
      bg: "rgba(217, 119, 87, 0.14)",
      border: "rgba(217, 119, 87, 0.32)",
    };
  }
  if (m.includes("gemini") || m.includes("google") || m.includes("gemma")) {
    return {
      id: "google",
      label: "Google",
      color: "#4285f4",
      bg: "rgba(66, 133, 244, 0.14)",
      border: "rgba(66, 133, 244, 0.32)",
    };
  }
  if (m.includes("deepseek")) {
    return {
      id: "deepseek",
      label: "DeepSeek",
      color: "#4d6bfe",
      bg: "rgba(77, 107, 254, 0.14)",
      border: "rgba(77, 107, 254, 0.32)",
    };
  }
  if (m.includes("glm") || m.includes("chatglm") || m.includes("zhipu")) {
    return {
      id: "glm",
      label: "Zhipu GLM",
      color: "#8b5cf6",
      bg: "rgba(139, 92, 246, 0.14)",
      border: "rgba(139, 92, 246, 0.32)",
    };
  }
  if (m.includes("grok") || m.includes("xai")) {
    return {
      id: "xai",
      label: "xAI",
      color: "#e5e7eb",
      bg: "rgba(255, 255, 255, 0.1)",
      border: "rgba(255, 255, 255, 0.22)",
    };
  }
  if (m.includes("llama") || m.includes("meta")) {
    return {
      id: "meta",
      label: "Meta",
      color: "#0a84ff",
      bg: "rgba(10, 132, 255, 0.14)",
      border: "rgba(10, 132, 255, 0.32)",
    };
  }
  if (m.includes("mistral") || m.includes("mixtral") || m.includes("codestral")) {
    return {
      id: "mistral",
      label: "Mistral",
      color: "#ff9f0a",
      bg: "rgba(255, 159, 10, 0.14)",
      border: "rgba(255, 159, 10, 0.32)",
    };
  }
  if (m.includes("qwen")) {
    return {
      id: "qwen",
      label: "Qwen",
      color: "#bf5af2",
      bg: "rgba(191, 90, 242, 0.14)",
      border: "rgba(191, 90, 242, 0.32)",
    };
  }

  return {
    id: "unknown",
    label: "AI Model",
    color: "#64d2ff",
    bg: "rgba(100, 210, 255, 0.12)",
    border: "rgba(100, 210, 255, 0.25)",
  };
}

interface ModelLogoProps {
  model: string;
  size?: number;
  withBadge?: boolean;
}

export const ModelLogo: React.FC<ModelLogoProps> = ({
  model,
  size = 16,
  withBadge = true,
}) => {
  const meta = detectProvider(model);

  const renderGlyph = () => {
    switch (meta.id) {
      case "openai":
        return (
          <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5Z" />
          </svg>
        );
      case "anthropic":
        return (
          <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
            <path d="M12 2L14.3 9.2L21.5 7L15.6 12L21.5 17L14.3 14.8L12 22L9.7 14.8L2.5 17L8.4 12L2.5 7L9.7 9.2L12 2Z" />
          </svg>
        );
      case "google":
        return (
          <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
            <defs>
              <linearGradient id="gemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4285F4" />
                <stop offset="50%" stopColor="#9B72CB" />
                <stop offset="100%" stopColor="#D96570" />
              </linearGradient>
            </defs>
            <path
              d="M12 2C12.3 7.4 16.6 11.7 22 12C16.6 12.3 12.3 16.6 12 22C11.7 16.6 7.4 12.3 2 12C7.4 11.7 11.7 7.4 12 2Z"
              fill="url(#gemGrad)"
            />
          </svg>
        );
      case "deepseek":
        return (
          <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
            <path d="M12 2C6.8 2 2.5 5.9 2.1 11C1.9 13.5 3.1 16 5.2 17.5C6.8 18.7 8.8 19.2 10.8 19C11.3 20.6 12.6 21.8 14.3 22C14.1 20.6 14.5 19.2 15.6 18.2C18.8 17.2 21.2 14.6 21.8 11.2C22.4 7.7 20.6 4.4 17.5 3C15.8 2.3 13.9 2 12 2ZM9.2 10.2C9.8 10.2 10.3 10.7 10.3 11.3C10.3 11.9 9.8 12.4 9.2 12.4C8.6 12.4 8.1 11.9 8.1 11.3C8.1 10.7 8.6 10.2 9.2 10.2ZM15.5 14.5C13.9 15.8 11.4 15.9 9.7 14.7C9.3 14.4 9.2 13.9 9.5 13.5C9.8 13.1 10.3 13 10.7 13.3C11.8 14.1 13.4 14 14.4 13.2C14.8 12.9 15.3 13 15.6 13.4C15.9 13.7 15.8 14.2 15.5 14.5Z" />
          </svg>
        );
      case "glm":
        return (
          <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 6H19L6 18H19" />
            <circle cx="19" cy="6" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="5" cy="18" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        );
      case "xai":
        return (
          <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        );
      case "meta":
        return (
          <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 12c-2-3.5-4.5-5-6.5-5C3 7 1.5 9.2 1.5 12s1.5 5 4 5c2.2 0 4.5-2 6.5-5 2 3 4.3 5 6.5 5 2.5 0 4-2.2 4-5s-1.5-5-4-5c-2 0-4.5 1.5-6.5 5z" />
          </svg>
        );
      case "mistral":
        return (
          <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
            <rect x="3" y="4" width="3.5" height="3.5" fill="#ffd60a" />
            <rect x="17.5" y="4" width="3.5" height="3.5" fill="#ffd60a" />
            <rect x="3" y="8.2" width="7" height="3.5" fill="#ff9f0a" />
            <rect x="14" y="8.2" width="7" height="3.5" fill="#ff9f0a" />
            <rect x="3" y="12.4" width="18" height="3.5" fill="#ff6b00" />
            <rect x="3" y="16.6" width="3.5" height="3.5" fill="#ff453a" />
            <rect x="10.25" y="16.6" width="3.5" height="3.5" fill="#ff453a" />
            <rect x="17.5" y="16.6" width="3.5" height="3.5" fill="#ff453a" />
          </svg>
        );
      case "qwen":
        return (
          <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2">
            <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
        );
    }
  };

  if (!withBadge) {
    return (
      <span className="model-logo-inline" style={{ color: meta.color, display: "inline-flex", alignItems: "center" }} title={meta.label}>
        {renderGlyph()}
      </span>
    );
  }

  return (
    <div
      className="model-logo-badge"
      style={{
        width: size + 12,
        height: size + 12,
        backgroundColor: meta.bg,
        borderColor: meta.border,
        color: meta.color,
      }}
      title={meta.label}
    >
      {renderGlyph()}
    </div>
  );
};
