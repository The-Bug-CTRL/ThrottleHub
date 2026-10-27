"use client";
import { RoostLoader } from "@/components/loading/roost-loader";
import { useState, useEffect } from "react";
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
  type User,
} from "firebase/auth";
import { accountProfile } from "@/lib/profile-client";
import { useSession } from "@/components/session";
import { Eye, EyeOff, LockKeyhole, ArrowLeft, ArrowRight } from "lucide-react";
import { auth } from "@/lib/firebase";
import { authReady } from "@/components/session";
import { firebaseMode } from "@/lib/firebase-settings";
import {
  AccountTypePicker,
  BusinessProfileFields,
} from "@/components/seller-account-fields";
import {
  emptyBusiness,
  businessSchema,
  type AccountType,
} from "@/lib/seller-account";
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
  const [accountType, setAccountType] = useState<AccountType | "">("");
  const [business, setBusiness] = useState({ ...emptyBusiness });
  const [setupUser, setSetupUser] = useState<User | null>(null);
  const router = useRouter();
  const { user: sessionUser, loading: sessionLoading } = useSession();
  useEffect(() => {
    if (
      sessionLoading ||
      !sessionUser ||
      new URLSearchParams(window.location.search).get("setup") !== "1"
    )
      return;
    let active = true;
    accountProfile(sessionUser)
      .then((result) => {
        if (!active) return;
        if (result.needsSetup) setSetupUser(sessionUser);
        else router.replace("/account");
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [sessionUser, sessionLoading, router]);
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
  async function completeProfile(user: User, selectedType: AccountType | "") {
    const result = await accountProfile(user, {
      ...(selectedType ? { accountType: selectedType } : {}),
      ...(selectedType === "business"
        ? { business: businessSchema.parse(business) }
        : {}),
      ...(user.displayName?.trim() && user.displayName.trim().length >= 2
        ? { displayName: user.displayName.trim().slice(0, 80) }
        : {}),
      ...(user.photoURL?.startsWith("https://")
        ? { photoURL: user.photoURL }
        : {}),
    });
    const complete = !result.needsSetup;
    if (!complete) {
      setAccountType("");
      setSetupUser(user);
      return false;
    }
    router.replace("/account");
    return true;
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
      await completeProfile(user, mode === "register" ? accountType : "");
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
  if (setupUser)
    return (
      <section className="auth-panel">
        <h1>Finish setting up your account</h1>
        <p>You’re signed in. Choose how you’ll use ThrottleHub.</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setMessage("");
            if (!accountType) {
              setMessage("Choose Personal or Business to continue.");
              return;
            }
            if (auth.currentUser?.uid !== setupUser.uid) {
              setSetupUser(null);
              setMessage(
                "Please sign in again to finish setting up your account.",
              );
              return;
            }
            setGoogleBusy(true);
            try {
              await completeProfile(setupUser, accountType);
            } catch (error) {
              setMessage(dataError(error));
            } finally {
              setGoogleBusy(false);
            }
          }}
        >
          <AccountTypePicker value={accountType} onChange={setAccountType} />
          {accountType === "business" && (
            <BusinessProfileFields value={business} onChange={setBusiness} />
          )}
          <button className="button" disabled={googleBusy}>
            {googleBusy ? "Saving…" : "Continue to my account"}
          </button>
        </form>
        {message && (
          <p role="alert" className="notice error">
            {message}
          </p>
        )}
      </section>
    );
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
      {mode === "register" && (
        <>
          <AccountTypePicker value={accountType} onChange={setAccountType} />
          {accountType === "business" && (
            <BusinessProfileFields value={business} onChange={setBusiness} />
          )}
          <small>
            Choose an account type when registering, including your first Google
            sign-in. Existing accounts keep their current type.
          </small>
        </>
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
                    if (!accountType)
                      throw Error(
                        "Choose Personal or Business before creating your account.",
                      );
                    if (accountType === "business")
                      businessSchema.parse(business);
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
                    const completed = await completeProfile(user, accountType);
                    if (!completed) return;
                    try {
                      await sendEmailVerification(user);
                    } catch {
                      // The profile is saved. Verification delivery can be retried from Account.
                    }
                  } else {
                    const { user } = await signInWithEmailAndPassword(
                      auth,
                      values.email,
                      values.password,
                    );
                    await completeProfile(user, "");
                    return;
                  }
                  router.replace("/account");
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
