import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Shared by the root layout and `global-error.tsx`, which replaces it and renders its own `<html>`. */
export const fontVariables = `${geistSans.variable} ${geistMono.variable}`;
