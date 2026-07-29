import { useColorScheme } from "react-native";

export interface AppColors {
  background: string;
  surface: string;
  surfaceVariant: string;
  text: string;
  muted: string;
  outline: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  error: string;
  warning: string;
  success: string;
}

export function useAppColors(): AppColors {
  const dark = useColorScheme() === "dark";
  return dark
    ? {
        background: "#0F141A",
        surface: "#171C22",
        surfaceVariant: "#222930",
        text: "#E8EDF2",
        muted: "#AAB4BE",
        outline: "#3B4650",
        primary: "#7CDCD4",
        onPrimary: "#003733",
        primaryContainer: "#0D4F4A",
        error: "#FFB4AB",
        warning: "#F4C56A",
        success: "#80D6A3",
      }
    : {
        background: "#F7F9FB",
        surface: "#FFFFFF",
        surfaceVariant: "#EDF2F5",
        text: "#182026",
        muted: "#5C6973",
        outline: "#CBD4DA",
        primary: "#006A64",
        onPrimary: "#FFFFFF",
        primaryContainer: "#9DF2E9",
        error: "#BA1A1A",
        warning: "#815600",
        success: "#176B3A",
      };
}
