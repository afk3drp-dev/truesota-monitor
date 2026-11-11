import React, { useId } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowUpRight } from "lucide-react";
import { appleAudio } from "../utils/audio";

interface TelegramCreditProps {
  variant?: "pill" | "card";
}

export const TelegramLogoIcon: React.FC<{ size?: number }> = ({
  size = 18,
}) => {
  const gradId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="tg-logo-svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="12" y1="0" x2="12" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#37BBFE" />
          <stop offset="100%" stopColor="#007DBB" />
        </linearGradient>
      </defs>
      {/* White plane shows cleanly through the official downloaded Telegram glyph cutout */}
      <circle cx="12" cy="12" r="10.2" fill="#FFFFFF" />
      <path
        d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
        fill={`url(#${gradId})`}
      />
    </svg>
  );
};

export const TelegramCredit: React.FC<TelegramCreditProps> = ({
  variant = "pill",
}) => {
  const handleOpenTelegram = async () => {
    appleAudio.playTap();
    try {
      await openUrl("https://t.me/afk3drp");
    } catch {
      window.open("https://t.me/afk3drp", "_blank", "noopener,noreferrer");
    }
  };

  if (variant === "card") {
    return (
      <button
        type="button"
        className="tg-credit-card-btn"
        onClick={handleOpenTelegram}
        title="Открыть Telegram t.me/afk3drp"
      >
        <div className="tg-credit-card-left">
          <div className="tg-icon-halo">
            <TelegramLogoIcon size={26} />
          </div>
          <div className="tg-credit-meta">
            <span className="tg-credit-name">
              Telegram автора <span className="tg-handle">by @afk3drp</span>
            </span>
            <span className="tg-credit-url">https://t.me/afk3drp</span>
          </div>
        </div>
        <span className="tg-open-chip">
          <span>Открыть</span>
          <ArrowUpRight size={13} />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="tg-credit-pill"
      onClick={handleOpenTelegram}
      title="Telegram: @afk3drp"
    >
      <TelegramLogoIcon size={15} />
      <span className="tg-credit-text">
        <span className="tg-by">by</span>{" "}
        <span className="tg-handle">@afk3drp</span>
      </span>
      <ArrowUpRight size={11} className="tg-arrow" />
    </button>
  );
};
