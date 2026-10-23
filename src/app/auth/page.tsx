"use client";
import { RoostLoader } from "@/components/loading/roost-loader";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc, runTransaction } from "firebase/firestore";
import { Eye, EyeOff, LockKeyhole, ArrowLeft, ArrowRight } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { authReady } from "@/components/session";
import { firebaseMode } from "@/lib/firebase-settings";
import { brand } from "@/lib/config";
import { dataError } from "@/lib/errors";
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().max(80),
});
type Values = z.infer<typeof schema>;
export default function Auth() {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login"),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState(false),
    [visible, setVisible] = useState(false),
    [resetting, setResetting] = useState(false),
    [googleBusy, setGoogleBusy] = useState(false);
  const router = useRouter();
  function destination() {
    const next = new URLSearchParams(window.location.search).get("next") || "";
    return /^\/seller\/[a-zA-Z0-9_-]{1,128}$/.test(next) ? next : "/account";
  }
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });
  function changeMode(m: typeof mode) {
    setMode(m);
    setMessage("");
    setSuccess(false);
  }
  async function googleSignIn() {
    setGoogleBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      await authReady;
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const { user } = await signInWithPopup(auth, provider);
      const profile = doc(db, "profiles", user.uid);
      const needsPhoto = await runTransaction(db, async (tx) => {
        const existing = await tx.get(profile);
        if (!existing.exists())
          tx.set(profile, {
            displayName:
              user.displayName && user.displayName.trim().length >= 2
                ? user.displayName.trim().slice(0, 80)
                : "Rider",
            bio: "",
            city: "",
            country: "ZA",
            sellerType: "private",
            createdAt: Date.now(),
          });
        return !existing.exists() || !existing.data().photoURL;
      });
      if (needsPhoto && user.photoURL?.startsWith("https://")) {
        try {
          await setDoc(profile, { photoURL: user.photoURL }, { merge: true });
        } catch {
          console.warn(
            "Signed in, but the public profile photo could not be synced.",
          );
        }
      }
      router.push(destination());
    } catch (error) {
      const code = (error as { code?: string }).code;
      setMessage(
        code === "auth/popup-closed-by-user"
          ? "Google sign-in was closed. Try again when you are ready."
          : code === "auth/popup-blocked"
            ? "Your browser blocked the sign-in window. Allow popups for this site and try again."
            : code === "auth/operation-not-allowed"
              ? "Google sign-in is not available yet. You can still use email and password."
              : code === "auth/account-exists-with-different-credential"
                ? "You already have an account with this email. Sign in with your existing method."
                : dataError(error),
      );
    } finally {
      setGoogleBusy(false);
    }
  }
  async function resetPassword() {
    const email = getValues("email");
    if (!z.string().email().safeParse(email).success) {
      setMessage("Enter a valid email address to request a reset.");
      return;
    }
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
      setMessage(
        firebaseMode === "emulator"
          ? "Reset requested. Use the link in your local Firebase emulator terminal."
          : "Reset requested. Check your inbox and spam folder for the reset link.",
      );
    } catch (error) {
      setSuccess(false);
      setMessage(dataError(error));
    } finally {
      setResetting(false);
    }
  }
  return (
    <section className="auth-panel">
      <div className="eyebrow">Your {brand.name} account</div>
      <h1>
        {mode === "reset"
          ? "Back in the saddle."
          : mode === "register"
            ? "Good rides start here."
            : "Welcome back, rider."}
      </h1>
      <p>
        {mode === "reset"
          ? "Enter your email and we’ll help you reset your password."
          : "One account for your garage, your conversations and your riding community."}
      </p>
      {mode !== "reset" && (
        <div className="auth-tabs" aria-label="Account access">
          <button
            className={mode === "login" ? "active" : ""}
            aria-pressed={mode === "login"}
            onClick={() => changeMode("login")}
          >
            Sign in
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            aria-pressed={mode === "register"}
            onClick={() => changeMode("register")}
          >
            Create account
          </button>
        </div>
      )}
      {mode !== "reset" && (
        <>
          {firebaseMode === "emulator" && (
            <p className="notice">
              Local test mode: Google opens a simulated account picker. Choose
              “Add new account” there to create a test identity. For your real
              Google account, restart with <code>npm run dev</code>.
            </p>
          )}
          <button
            className="button-secondary google-sign-in"
            type="button"
            disabled={googleBusy || isSubmitting}
            onClick={googleSignIn}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.4 3-7.5Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.4L6.4 10A6 6 0 0 1 12 5.9Z"
              />
            </svg>
            {googleBusy ? "Signing in..." : "Continue with Google"}
          </button>
          <p className="auth-divider">or use your email</p>
        </>
      )}
      <form
        noValidate
        onSubmit={
          mode === "reset"
            ? (e) => {
                e.preventDefault();
                void resetPassword();
              }
            : handleSubmit(async (values) => {
                setMessage("");
                setSuccess(false);
                try {
                  await authReady;
                  if (mode === "register") {
                    if (values.name.trim().length < 2) {
                      setMessage(
                        "Please enter a display name of at least two characters.",
                      );
                      return;
                    }
                    const { user } = await createUserWithEmailAndPassword(
                      auth,
                      values.email,
                      values.password,
                    );
                    await updateProfile(user, {
                      displayName: values.name.trim(),
                    });
                    await setDoc(doc(db, "profiles", user.uid), {
                      displayName: values.name.trim(),
                      bio: "",
                      city: "",
                      country: "ZA",
                      sellerType: "private",
                      createdAt: Date.now(),
                    });
                    await sendEmailVerification(user);
                  } else
                    await signInWithEmailAndPassword(
                      auth,
                      values.email,
                      values.password,
                    );
                  router.push(destination());
                } catch (error) {
                  setMessage(dataError(error));
                }
              })
        }
      >
        {mode === "register" && (
          <label>
            Display name
            <input
              {...register("name")}
              autoComplete="nickname"
              placeholder="What should other riders call you?"
              maxLength={80}
            />
            <small>This name appears on your public profile.</small>
          </label>
        )}
        <label>
          Email address
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <small id="email-error" className="error">
              Enter a valid email address.
            </small>
          )}
        </label>
        {mode !== "reset" && (
          <label>
            Password
            <div className="password-field">
              <input
                {...register("password")}
                type={visible ? "text" : "password"}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder={
                  mode === "register"
                    ? "At least 8 characters"
                    : "Your password"
                }
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password ? "password-error" : undefined
                }
              />
              <button
                type="button"
                className="icon-button"
                aria-label={visible ? "Hide password" : "Show password"}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <small id="password-error" className="error">
                Use at least 8 characters.
              </small>
            )}
          </label>
        )}
        <button
          className="button"
          disabled={isSubmitting || resetting || googleBusy}
        >
          {isSubmitting || resetting
            ? "Please wait…"
            : mode === "reset"
              ? "Send reset link"
              : mode === "register"
                ? "Create my account"
                : "Sign in"}
          {isSubmitting || resetting ? (
            <RoostLoader size={48} label="Processing account request" />
          ) : (
            <ArrowRight size={17} />
          )}
        </button>
      </form>
      {message && (
        <p
          role={success ? "status" : "alert"}
          className={`notice ${success ? "success" : "error"}`}
        >
          {message}
        </p>
      )}
      {mode === "reset" ? (
        <button className="text-button" onClick={() => changeMode("login")}>
          <ArrowLeft size={15} />
          Back to sign in
        </button>
      ) : (
        <button className="text-button" onClick={() => changeMode("reset")}>
          Forgot your password?
        </button>
      )}
      <div className="auth-note">
        <LockKeyhole size={14} />
        Your contact details stay private by default.
      </div>
      <p className="auth-policy">
        New here? Read our{" "}
        <Link href="/policies/rules">marketplace safety guidance</Link> before
        your first trade.
      </p>
    </section>
  );
}
