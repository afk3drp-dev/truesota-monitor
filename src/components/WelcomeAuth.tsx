import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  KeyRound,
  Eye,
  EyeOff,
  ClipboardPaste,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Loader2,
  WifiOff,
} from "lucide-react";
import CursorGrid from "./reactbits/CursorGrid";
import FoldText from "./reactbits/FoldText";
import DecryptedText from "./reactbits/DecryptedText";
import GlassSurface from "./reactbits/GlassSurface";
import MagicBento, { type MagicBentoItem } from "./reactbits/MagicBento";
import SpecularButton from "./reactbits/SpecularButton";
import { TelegramCredit } from "./TelegramCredit";
import { appleAudio } from "../utils/audio";

interface WelcomeAuthProps {
  onAuthenticated: (key: string, initialData: unknown | null) => void;
}

const BENTO_FEATURES: MagicBentoItem[] = [
  {
    id: "models",
    label: "ТЕЛЕМЕТРИЯ И ТАРИФЫ",
    title: "Модели, прайс и группы",
    description: "Live-тарифы TrueSOTA, множители групп и рейтинг расхода",
    visual: "integration",
  },
  {
    id: "analytics",
    label: "АНАЛИТИКА",
    title: "Heatmap & Аудит кэша",
    description: "Тепловая карта за 22 недели и расчёт экономии",
    visual: "analytics",
  },
  {
    id: "desktop",
    label: "WINDOWS 11",
    title: "Dynamic Island & ⌘K",
    description: "Виджет поверх окон, Mica-стекло и Share Card",
    visual: "security",
  },
];

export const WelcomeAuth: React.FC<WelcomeAuthProps> = ({
  onAuthenticated,
}) => {
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);

  const handlePaste = async () => {
    appleAudio.playTap();
    setErrorMsg(null);
    try {
      const txt = await navigator.clipboard.readText();
      if (txt && txt.trim()) {
        setKeyInput(txt.trim());
      } else {
        setErrorMsg("Буфер обмена пуст — вставьте ключ вручную через Ctrl+V");
      }
    } catch {
      setErrorMsg("Нет доступа к буферу — нажмите Ctrl+V в поле ввода");
    }
  };

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = keyInput.trim();
    if (!cleaned) {
      setErrorMsg("Введите ваш API ключ доступа TrueSOTA");
      return;
    }

    appleAudio.playTap();
    setLoading(true);
    setErrorMsg(null);
    setNetworkError(false);

    try {
      const usageRes = await invoke<unknown>("fetch_usage", {
        apiKey: cleaned,
      });
      await invoke<string>("save_api_key", { key: cleaned });
      appleAudio.playSuccessChime();
      onAuthenticated(cleaned, usageRes);
    } catch (err) {
      const msg = String(err);
      const isHttpReject =
        msg.includes("401") ||
        msg.includes("403") ||
        msg.toLowerCase().includes("unauthorized") ||
        msg.toLowerCase().includes("invalid");

      if (isHttpReject) {
        setErrorMsg("Сервер отклонил ключ (HTTP 401/403). Проверьте правильность токена.");
      } else {
        setErrorMsg(`Ошибка подключения: ${msg}`);
        if (msg.toLowerCase().includes("сети") || msg.toLowerCase().includes("network")) {
          setNetworkError(true);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOfflineAnyway = async () => {
    const cleaned = keyInput.trim();
    if (!cleaned) return;
    appleAudio.playSwitch();
    try {
      await invoke<string>("save_api_key", { key: cleaned });
      onAuthenticated(cleaned, null);
    } catch (err) {
      setErrorMsg(String(err));
    }
  };

  return (
    <div className="welcome-stage">
      {/* React Bits: WebGL CursorGrid ambient dark surface */}
      <div className="welcome-grid-bg" aria-hidden="true">
        <CursorGrid
          cellSize={40}
          color="#0a84ff"
          gridColor="#1c273b"
          radius={140}
          falloff="smooth"
          highlight="area"
          gridStyle="crosses"
          gridOpacity={0.28}
          maxOpacity={0.44}
          fillOpacity={0.14}
          spotlight={0.5}
          ambient={0.12}
          clickPulse={true}
          edgeFade={0.45}
          intro={true}
        />
      </div>

      <div className="welcome-content-scroll">
        {/* Hero Headline with FoldText + DecryptedText */}
        <div className="welcome-hero">
          <div className="welcome-security-pill">
            <ShieldCheck size={13} style={{ color: "var(--apple-green)" }} />
            <span>Локальное хранение ключа • Подходит любой API ключ</span>
          </div>

          <div className="welcome-title-wrap">
            <FoldText
              text="TrueSOTA Monitor"
              splitBy="word"
              hinge="top"
              foldStyle="paper"
              duration={0.68}
              stagger={0.075}
              foldAngle={72}
              color="#f5f5f7"
              fontSize={38}
              fontWeight={700}
              className="welcome-fold-headline"
            />
          </div>

          <div className="welcome-sub-wrap">
            <DecryptedText
              text="Мониторинг квоты, аналитика расхода и аудит Prompt Cache"
              speed={32}
              maxIterations={12}
              sequential={true}
              revealDirection="start"
              animateOn="view"
              scrambleColor="#64d2ff"
              className="welcome-decrypted-final"
              encryptedClassName="welcome-decrypted-cipher"
            />
          </div>
        </div>

        {/* Central Auth Card wrapped in React Bits GlassSurface */}
        <div className="welcome-card-shell">
          <GlassSurface
            width="100%"
            height="auto"
            borderRadius={20}
            blur={16}
            backgroundOpacity={0.14}
            brightness={36}
            saturation={1.45}
            refraction={false}
            className="welcome-glass-card"
          >
            <form className="welcome-auth-form" onSubmit={handleSignIn}>
              <div className="welcome-form-top">
                <div className="welcome-form-badge">
                  <KeyRound size={15} style={{ color: "var(--apple-blue)" }} />
                  <span>Вход в аккаунт по ключу</span>
                </div>
                <span className="welcome-form-note">Authorization: Bearer</span>
              </div>

              <div className="welcome-input-group">
                <input
                  type={showKey ? "text" : "password"}
                  className="welcome-key-input"
                  value={keyInput}
                  onChange={(e) => {
                    setKeyInput(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Вставьте ваш TrueSOTA API ключ (любой токен)..."
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                />

                <div className="welcome-input-tools">
                  <button
                    type="button"
                    className="welcome-tool-btn"
                    onClick={() => setShowKey((v) => !v)}
                    title={showKey ? "Скрыть ключ" : "Показать ключ"}
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    className="welcome-tool-btn paste"
                    onClick={handlePaste}
                    title="Вставить ключ из буфера обмена"
                  >
                    <ClipboardPaste size={13} />
                    <span>Вставить</span>
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="welcome-error-box">
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                  {networkError && (
                    <button
                      type="button"
                      className="welcome-offline-btn"
                      onClick={handleSaveOfflineAnyway}
                    >
                      <WifiOff size={12} />
                      <span>Войти оффлайн</span>
                    </button>
                  )}
                </div>
              )}

              <div className="welcome-submit-row">
                <span className="welcome-privacy-hint">
                  Сохраняется локально в <code>%APPDATA%\TrueSOTA_Monitor</code>
                </span>

                <SpecularButton
                  type="submit"
                  size="md"
                  radius={12}
                  tint="#0a84ff"
                  tintOpacity={0.22}
                  blur={8}
                  textColor="#ffffff"
                  lineColor="#7dd3fc"
                  baseColor="#1e3a8a"
                  intensity={1.15}
                  idleIntensity={0.45}
                  glow={0.9}
                  disabled={loading || !keyInput.trim()}
                  className="welcome-specular-cta"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="spin-inline" />
                      <span>Проверка...</span>
                    </>
                  ) : (
                    <>
                      <span>Войти</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </SpecularButton>
              </div>
            </form>
          </GlassSurface>
        </div>

        {/* Bottom Feature Grid powered by React Bits MagicBento */}
        <div className="welcome-bento-wrap">
          <MagicBento
            items={BENTO_FEATURES}
            columns={3}
            rowHeight={116}
            gap={10}
            radius={16}
            theme="dark"
            glowColor="#0a84ff"
            enableBorderGlow={true}
            enableSpotlight={true}
            spotlightRadius={260}
            enableStars={true}
            particleCount={8}
            enableTilt={true}
            enableMagnetism={false}
            clickEffect={true}
            intro={true}
          />
        </div>

        <div className="welcome-credit-row">
          <TelegramCredit variant="pill" />
        </div>
      </div>
    </div>
  );
};
