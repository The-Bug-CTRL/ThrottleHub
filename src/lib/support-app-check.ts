"use client";
import { getApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getLimitedUseToken,
  type AppCheck,
} from "firebase/app-check";
let instance: AppCheck | undefined;
export async function supportGuestToken() {
  const key = process.env.NEXT_PUBLIC_SUPPORT_RECAPTCHA_KEY;
  if (!key)
    throw Error(
      "Guest support is not configured yet. Please try password reset.",
    );
  instance ||= initializeAppCheck(getApp(), {
    provider: new ReCaptchaEnterpriseProvider(key),
    isTokenAutoRefreshEnabled: true,
  });
  return (await getLimitedUseToken(instance)).token;
}
