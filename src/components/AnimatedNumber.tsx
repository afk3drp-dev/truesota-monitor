import React, { useEffect, useState, useRef } from "react";

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
  splitDecimals?: boolean;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  decimals = 2,
  prefix = "",
  suffix = "",
  duration = 800,
  className = "",
  splitDecimals = false,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const startValueRef = useRef<number>(value);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startVal = displayValue;
    const targetVal = value;
    startValueRef.current = startVal;
    startTimeRef.current = null;

    if (startVal === targetVal) {
      setDisplayValue(targetVal);
      return;
    }

    const easeOutExpo = (x: number): number => {
      return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
    };

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);

      const current = startVal + (targetVal - startVal) * easedProgress;
      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetVal);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [value, duration]);

  const formatted = displayValue.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (splitDecimals && decimals > 0) {
    const dotIndex = formatted.lastIndexOf(".");
    const intPart = dotIndex >= 0 ? formatted.slice(0, dotIndex) : formatted;
    const decPart = dotIndex >= 0 ? formatted.slice(dotIndex) : "";
    return (
      <span className={className}>
        {prefix && <span className="animated-prefix">{prefix}</span>}
        <span className="animated-int">{intPart}</span>
        {decPart && <span className="animated-decimals">{decPart}</span>}
        {suffix}
      </span>
    );
  }

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
