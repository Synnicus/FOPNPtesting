import React, { forwardRef } from 'react';
import {
  Alert as NativeAlert,
  Pressable as NativePressable,
  Text as NativeText,
  TextInput as NativeTextInput,
  TouchableOpacity as NativeTouchableOpacity,
  type AlertButton,
  type AlertOptions,
  type PressableProps,
  type TextInputProps,
  type TextProps,
  type TouchableOpacityProps,
} from 'react-native';
import { useLocalization } from '@/context/LocalizationContext';
import { getActiveLocale, translateText } from '@/data/localization';

export function localizedConfirm(title: string, message?: string): boolean {
  if (typeof window === 'undefined') return false;
  const prompt = message
    ? `${translateText(title)}\n\n${translateText(message)}`
    : translateText(title);
  return window.confirm(prompt);
}

function translateChildren(children: React.ReactNode, locale: ReturnType<typeof getActiveLocale>): React.ReactNode {
  if (typeof children === 'string') return translateText(children, locale);
  if (Array.isArray(children)) return children.map((child, index) => (
    <React.Fragment key={index}>{translateChildren(child, locale)}</React.Fragment>
  ));
  return children;
}

export function LocalizedText({ children, accessibilityLabel, accessibilityHint, ...props }: TextProps) {
  const { locale } = useLocalization();
  return (
    <NativeText
      {...props}
      accessibilityLabel={accessibilityLabel ? translateText(accessibilityLabel, locale) : accessibilityLabel}
      accessibilityHint={accessibilityHint ? translateText(accessibilityHint, locale) : accessibilityHint}
    >
      {translateChildren(children, locale)}
    </NativeText>
  );
}

export function LocalizedTextInput({ placeholder, accessibilityLabel, accessibilityHint, ...props }: TextInputProps) {
  const { locale } = useLocalization();
  return (
    <NativeTextInput
      {...props}
      placeholder={placeholder ? translateText(placeholder, locale) : placeholder}
      accessibilityLabel={accessibilityLabel ? translateText(accessibilityLabel, locale) : accessibilityLabel}
      accessibilityHint={accessibilityHint ? translateText(accessibilityHint, locale) : accessibilityHint}
    />
  );
}

export const LocalizedTouchableOpacity = forwardRef<
  React.ComponentRef<typeof NativeTouchableOpacity>,
  TouchableOpacityProps
>(function LocalizedTouchableOpacity({ accessibilityLabel, accessibilityHint, ...props }, ref) {
  const { locale } = useLocalization();
  return (
    <NativeTouchableOpacity
      {...props}
      ref={ref}
      accessibilityLabel={accessibilityLabel ? translateText(accessibilityLabel, locale) : accessibilityLabel}
      accessibilityHint={accessibilityHint ? translateText(accessibilityHint, locale) : accessibilityHint}
    />
  );
});

export const LocalizedPressable = forwardRef<
  React.ComponentRef<typeof NativePressable>,
  PressableProps
>(function LocalizedPressable({ accessibilityLabel, accessibilityHint, ...props }, ref) {
  const { locale } = useLocalization();
  return (
    <NativePressable
      {...props}
      ref={ref}
      accessibilityLabel={accessibilityLabel ? translateText(accessibilityLabel, locale) : accessibilityLabel}
      accessibilityHint={accessibilityHint ? translateText(accessibilityHint, locale) : accessibilityHint}
    />
  );
});

export const LocalizedAlert = {
  alert(title?: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    const locale = getActiveLocale();
    NativeAlert.alert(
      title ? translateText(title, locale) : '',
      message ? translateText(message, locale) : message,
      buttons?.map(button => ({
        ...button,
        text: button.text ? translateText(button.text, locale) : button.text,
      })),
      options,
    );
  },
};
