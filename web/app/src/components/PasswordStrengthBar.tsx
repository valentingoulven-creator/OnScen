import { useEffect, useState } from 'react';
import {
  getPasswordStrength,
  preloadPasswordStrength,
  STRENGTH_CONFIG,
  TOTAL_BARS,
} from '../lib/passwordStrength';

export function PasswordStrengthBar({ password }: { password: string }) {
  const [strength, setStrength] = useState(() => getPasswordStrength(password));

  useEffect(() => {
    void preloadPasswordStrength();
  }, []);

  useEffect(() => {
    setStrength(getPasswordStrength(password));
    let cancelled = false;
    void preloadPasswordStrength().then(() => {
      if (!cancelled) setStrength(getPasswordStrength(password));
    });
    return () => {
      cancelled = true;
    };
  }, [password]);

  const cfg = STRENGTH_CONFIG[strength];
  if (!password) return null;
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {Array.from({ length: TOTAL_BARS }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < cfg.bars ? cfg.color : 'bg-gray-700'}`}
          />
        ))}
      </div>
      {cfg.label && (
        <p className={`text-[11px] font-medium ${cfg.textColor}`}>
          Sécurité : {cfg.label}
        </p>
      )}
    </div>
  );
}
