"use client";

import { ArrowLeft, Check, LoaderCircle, LockKeyhole, Mail, RotateCcw, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { ensureAdminSession } from "@/lib/api/client";
import { getAdminMe, requestAdminOtp, verifyAdminOtp } from "@/lib/api/endpoints/adminAuth";
import { isMockApi } from "@/lib/mock/adapter";
import { ADMIN_SESSION_COOKIE, useAdminAuthStore } from "@/lib/store/adminAuthStore";
import { buttonClass, inputClass } from "./AdminUI";
import { ADMIN_BASE, friendlyError } from "./admin-utils";

const OTP_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatCountdown(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function OtpLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resendIn, setResendIn] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const setSession = useAdminAuthStore((state) => state.setSession);
  const sessionExpired = useAdminAuthStore((state) => state.sessionExpired);

  useEffect(() => {
    let cancelled = false;
    const hasSessionHint = document.cookie.split(";").some((part) => part.trim().startsWith(`${ADMIN_SESSION_COOKIE}=`));
    if (isMockApi && !hasSessionHint) {
      setCheckingSession(false);
      return;
    }
    void (async () => {
      const restored = await ensureAdminSession();
      if (cancelled) return;
      if (!restored) {
        setCheckingSession(false);
        return;
      }
      if (!useAdminAuthStore.getState().email) {
        try {
          const me = await getAdminMe();
          useAdminAuthStore.setState({ email: me.email });
        } catch {
          // The access token is enough to enter; the address can stay blank until the next login.
        }
      }
      const next = searchParams.get("next");
      router.replace(next && next.startsWith(ADMIN_BASE) ? next : ADMIN_BASE);
      router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  useEffect(() => {
    if (!resendIn && !expiresIn) return;
    const timer = window.setInterval(() => {
      setResendIn((value) => Math.max(0, value - 1));
      setExpiresIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendIn, expiresIn]);

  const requestOtp = async (event?: FormEvent) => {
    event?.preventDefault();
    if (loading) return;
    setError("");
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("أدخل بريدًا إلكترونيًا صالحًا.");
      return;
    }
    setLoading(true);
    try {
      const response = await requestAdminOtp({ email: email.trim() });
      setStep("otp");
      setDigits(Array(OTP_LENGTH).fill(""));
      setResendIn(response.resendAvailableInSeconds);
      setExpiresIn(response.expiresInSeconds);
      window.setTimeout(() => refs.current[0]?.focus(), 50);
    } catch (requestError) {
      setError(friendlyError(requestError, "تعذّر إرسال الرمز. تحقق من اتصالك وحاول مجددًا."));
    } finally {
      setLoading(false);
    }
  };

  const updateDigit = (index: number, value: string) => {
    const nextValue = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = nextValue;
    setDigits(next);
    setError("");
    if (nextValue && index < OTP_LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const pasteOtp = (event: ClipboardEvent) => {
    const value = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!value) return;
    event.preventDefault();
    const next = Array<string>(OTP_LENGTH).fill("");
    value.split("").forEach((digit, index) => {
      next[index] = digit;
    });
    setDigits(next);
    refs.current[Math.min(value.length, OTP_LENGTH) - 1]?.focus();
  };

  const verifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    const code = digits.join("");
    if (code.length !== OTP_LENGTH) {
      setError("أدخل رمز التحقق المكوّن من 6 أرقام.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await verifyAdminOtp({ email: email.trim(), code });
      // setSession also writes the `rival_admin_session` routing cookie for the middleware.
      setSession({ email: email.trim(), accessToken: response.accessToken, expiresIn: response.expiresIn });
      const next = searchParams.get("next");
      router.push(next && next.startsWith(ADMIN_BASE) ? next : ADMIN_BASE);
      router.refresh();
    } catch (verifyError) {
      setError(friendlyError(verifyError, "الرمز غير صحيح أو انتهت صلاحيته."));
      setDigits(Array(OTP_LENGTH).fill(""));
      window.setTimeout(() => refs.current[0]?.focus(), 30);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main dir="rtl" className="relative min-h-screen overflow-hidden bg-[#16130f] text-[#1f1a15]">
      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_15%_20%,#9e764a_0,transparent_27%),radial-gradient(circle_at_85%_85%,#5b452f_0,transparent_30%)]" />
      <div className="absolute inset-y-0 left-[47%] hidden w-px bg-gradient-to-b from-transparent via-white/15 to-transparent lg:block" />
      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-16 px-5 py-10 lg:grid-cols-2 lg:px-12">
        <section className="hidden text-white lg:block">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d6ba90]/25 bg-white/5 px-4 py-2 text-xs text-[#dfc9aa]">
            <ShieldCheck className="h-4 w-4" /> بوابة إدارية آمنة
          </span>
          <h1 className="mt-8 font-display text-6xl leading-[1.2]">إدارة الأناقة<br /><span className="text-[#cba876]">بوضوح كامل.</span></h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-white/55">مساحة واحدة لمتابعة الطلبات والمخزون وتجربة عملاء Rival، مصممة لتمنحك التفاصيل المهمة دون ضوضاء.</p>
          <div className="mt-14 flex items-center gap-4 text-xs text-white/35">
            <span className="h-px w-12 bg-[#c7a478]/50" />
            RIVAL PRIVATE MANAGEMENT
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-[2rem] border border-white/40 bg-[#f9f5ee] p-6 shadow-[0_40px_100px_rgba(0,0,0,.35)] sm:p-9">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <span className="font-display text-2xl tracking-[0.18em]">RIVAL</span>
              <p className="mt-1 text-[10px] tracking-[0.22em] text-[#9f7d55]">MANAGEMENT</p>
            </div>
            <span className="rounded-2xl bg-[#eae0d2] p-3 text-[#805e3b]"><LockKeyhole className="h-5 w-5" /></span>
          </div>

          {checkingSession ? (
            <div className="py-16 text-center">
              <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-[#8c6338]" />
              <p className="mt-4 text-sm font-bold">جاري فتح لوحة التحكم</p>
            </div>
          ) : null}

          {!checkingSession && sessionExpired && step === "email" && (
            <p role="status" className="mb-5 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">انتهت جلستك السابقة. سجّل الدخول مجددًا للمتابعة.</p>
          )}

          {!checkingSession && step === "email" ? (
            <form onSubmit={requestOtp} noValidate>
              <p className="text-xs font-bold text-[#a17647]">تسجيل دخول المسؤول</p>
              <h2 className="mt-2 text-3xl font-black">مرحبًا بعودتك</h2>
              <p className="mt-3 text-sm leading-6 text-[#766d64]">سنرسل رمز تحقق لمرة واحدة إلى بريدك المعتمد.</p>
              <label className="mt-8 block">
                <span className="mb-2 block text-sm font-bold">البريد الإلكتروني</span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9d8f80]" />
                  <input
                    dir="ltr"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={`${inputClass} py-4 pl-4 pr-12 text-left`}
                    placeholder="admin@rival.ps"
                    aria-invalid={Boolean(error)}
                  />
                </span>
              </label>
              {error && <p role="alert" className="mt-2 text-xs font-bold text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className={`${buttonClass} mt-6 w-full py-4`}>
                {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <><span>إرسال رمز التحقق</span><ArrowLeft className="h-4 w-4" /></>}
              </button>
            </form>
          ) : !checkingSession ? (
            <form onSubmit={verifyOtp} noValidate>
              <p className="text-xs font-bold text-[#a17647]">التحقق بخطوتين</p>
              <h2 className="mt-2 text-3xl font-black">أدخل الرمز</h2>
              <p className="mt-3 text-sm leading-6 text-[#766d64]">أرسلنا رمزًا من 6 أرقام إلى <strong dir="ltr" className="text-[#32291f]">{email}</strong></p>
              {isMockApi && <p className="mt-3 rounded-xl bg-[#eee5d8] px-3 py-2 text-center text-xs font-bold text-[#765736]">رمز العرض التجريبي: <span dir="ltr">123456</span></p>}
              <div dir="ltr" className="mt-8 flex justify-center gap-2" onPaste={pasteOtp}>
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => { refs.current[index] = element; }}
                    value={digit}
                    onChange={(event) => updateDigit(index, event.target.value)}
                    onKeyDown={(event) => handleKeyDown(index, event)}
                    onFocus={(event) => event.target.select()}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    disabled={loading}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    aria-label={`الرقم ${index + 1} من رمز التحقق`}
                    className="h-14 w-11 rounded-2xl border border-black/10 bg-white text-center text-xl font-black outline-none transition focus:border-[#a98050] focus:ring-4 focus:ring-[#c7a478]/15 disabled:opacity-60 sm:h-16 sm:w-12"
                  />
                ))}
              </div>
              {error && <p role="alert" className="mt-3 text-center text-xs font-bold text-red-600">{error}</p>}
              <div className="mt-6 flex items-center justify-between text-xs">
                <button type="button" onClick={() => { setStep("email"); setError(""); setDigits(Array(OTP_LENGTH).fill("")); }} className="font-bold text-[#70583d] underline underline-offset-4">تغيير البريد</button>
                {resendIn ? (
                  <span className="text-[#8f857b]">إعادة الإرسال خلال <strong dir="ltr">{formatCountdown(resendIn)}</strong></span>
                ) : (
                  <button type="button" disabled={loading} onClick={() => requestOtp()} className="inline-flex items-center gap-1 font-bold text-[#8c6338] disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" /> إعادة الإرسال</button>
                )}
              </div>
              <p className="mt-3 text-center text-[11px] text-[#958a80]" aria-live="polite">
                {expiresIn > 0 ? <>تنتهي صلاحية الرمز خلال <strong dir="ltr">{formatCountdown(expiresIn)}</strong></> : "انتهت صلاحية الرمز، اطلب رمزًا جديدًا."}
              </p>
              <button type="submit" disabled={loading || digits.some((digit) => !digit)} className={`${buttonClass} mt-7 w-full py-4`}>
                {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <><span>دخول لوحة التحكم</span><Check className="h-4 w-4" /></>}
              </button>
            </form>
          ) : null}
          <p className="mt-8 text-center text-[10px] leading-5 text-[#9d9388]">هذه الصفحة مخصصة للمصرح لهم فقط. جميع محاولات الدخول مسجلة.</p>
        </section>
      </div>
    </main>
  );
}
