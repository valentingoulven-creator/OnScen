import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  birthDateFieldsToIso,
  isoToBirthDateFields,
  usesEuropeanDateFormat,
  type BirthDateFields,
} from '../lib/profileAge';

interface BirthDateInputProps {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  inputClassName?: string;
}

function digitsOnly(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, '').slice(0, maxLen);
}

function DatePartField({
  id,
  label,
  placeholder,
  value,
  maxLength,
  onChange,
  inputClassName,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  maxLength: number;
  onChange: (next: string) => void;
  inputClassName: string;
}) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="text-[10px] text-gray-500">{label}</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="bday-day"
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(digitsOnly(e.target.value, maxLength))}
        className={inputClassName}
      />
    </label>
  );
}

export function BirthDateInput({
  value,
  onChange,
  className = '',
  inputClassName = 'mt-0.5 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-white text-sm text-center tabular-nums',
}: BirthDateInputProps) {
  const { i18n, t } = useTranslation();
  const european = usesEuropeanDateFormat(i18n.language);
  const [fields, setFields] = useState<BirthDateFields>(() => isoToBirthDateFields(value));

  useEffect(() => {
    setFields(isoToBirthDateFields(value));
  }, [value]);

  const updateField = (key: keyof BirthDateFields, next: string) => {
    const updated = { ...fields, [key]: next };
    setFields(updated);
    onChange(birthDateFieldsToIso(updated));
  };

  const dayField = (
    <DatePartField
      id="birth-date-day"
      label={t('profile.birthDateDay')}
      placeholder={t('profile.birthDateDayPlaceholder')}
      value={fields.day}
      maxLength={2}
      onChange={(next) => updateField('day', next)}
      inputClassName={inputClassName}
    />
  );
  const monthField = (
    <DatePartField
      id="birth-date-month"
      label={t('profile.birthDateMonth')}
      placeholder={t('profile.birthDateMonthPlaceholder')}
      value={fields.month}
      maxLength={2}
      onChange={(next) => updateField('month', next)}
      inputClassName={inputClassName}
    />
  );
  const yearField = (
    <DatePartField
      id="birth-date-year"
      label={t('profile.birthDateYear')}
      placeholder={t('profile.birthDateYearPlaceholder')}
      value={fields.year}
      maxLength={4}
      onChange={(next) => updateField('year', next)}
      inputClassName={inputClassName}
    />
  );

  return (
    <div className={className}>
      <div className="mt-1 flex gap-2">
        {european ? (
          <>
            {dayField}
            {monthField}
            {yearField}
          </>
        ) : (
          <>
            {monthField}
            {dayField}
            {yearField}
          </>
        )}
      </div>
      <p className="text-[10px] text-gray-600 mt-1">{t('profile.birthDateFormatHint')}</p>
    </div>
  );
}
