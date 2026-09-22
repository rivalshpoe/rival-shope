"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BadgePercent, Banknote, Check, MapPin, Phone, ShieldCheck, ShoppingBag, Truck, WifiOff, X } from "lucide-react";
import { z } from "zod";
import { useShop } from "@/components/layout/ShopProvider";
import { ErrorState } from "@/components/ui/ErrorState";
import { SectionHead } from "@/components/ui/SectionHead";
import { SkeletonList } from "@/components/ui/Skeleton";
import { SmartImage } from "@/components/ui/SmartImage";
import { Spinner } from "@/components/ui/Spinner";
import { AppError } from "@/lib/api/errors";
import { POLICY_ROUTES, ROUTES } from "@/lib/constants/routes";
import { useCreateOrder, useDeliveryZones, useValidateDiscountCode } from "@/lib/hooks/queries";
import { useIdempotencyKey } from "@/lib/hooks/useIdempotencyKey";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { useCheckoutStore, type CheckoutForm, type CheckoutStep } from "@/lib/store/checkoutStore";
import { formatPrice } from "@/lib/utils/formatCurrency";
import { normalizePhoneNumber } from "@/lib/utils/formatPhone";
import styles from "./CheckoutExperience.module.css";

const STEPS: { title: string; short: string; icon: typeof Truck }[] = [
  { title: "مراجعة الحقيبة", short: "الحقيبة", icon: ShoppingBag },
  { title: "التوصيل", short: "التوصيل", icon: Truck },
  { title: "بيانات التواصل", short: "التواصل", icon: Phone },
  { title: "الدفع والتأكيد", short: "الدفع", icon: Banknote },
];

const deliverySchema = z
  .object({
    needsDelivery: z.boolean(),
    deliveryZoneId: z.string(),
    address: z.string().trim(),
  })
  .superRefine((value, ctx) => {
    if (!value.needsDelivery) return;
    if (!value.deliveryZoneId) ctx.addIssue({ code: "custom", path: ["deliveryZoneId"], message: "اختاري منطقة التوصيل" });
    if (value.address.length < 8) ctx.addIssue({ code: "custom", path: ["address"], message: "اكتبي عنوانًا واضحًا (المدينة، الحي، أقرب معلم)" });
  });

const contactSchema = z.object({
  customerName: z.string().trim().min(2, "اكتبي اسمكِ الكامل").max(80, "الاسم طويل جدًا"),
  whatsAppCountryCode: z.enum(["970", "972"]),
  phoneNumber: z
    .string()
    .transform(normalizePhoneNumber)
    .refine((value) => /^5\d{8}$/.test(value), "رقم الواتساب يجب أن يبدأ بـ 5 ويتكوّن من 9 أرقام"),
});

type FieldErrors = Partial<Record<keyof CheckoutForm, string>>;

function zodErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in result)) result[key as keyof CheckoutForm] = issue.message;
  }
  return result;
}

export function CheckoutExperience() {
  const shop = useShop();
  const step = useCheckoutStore((state) => state.step);
  const setStep = useCheckoutStore((state) => state.setStep);

  useEffect(() => {
    // Never let a persisted step outrun an emptied cart.
    if (shop.hydrated && shop.cart.length === 0 && step !== 0) setStep(0);
  }, [shop.cart.length, shop.hydrated, step, setStep]);

  return (
    <div className={`container ${styles.page}`}>
      <div className="page-hero">
        <SectionHead as="h1" eyebrow="إتمام الطلب" title="خطوات بسيطة لتصل إليكِ" description="الدفع نقدًا عند الاستلام، وتأكيد سريع عبر واتساب." />
      </div>
      <Stepper step={step} onStep={(target) => target < step && setStep(target)} />
      {!shop.hydrated ? (
        <SkeletonList rows={3} />
      ) : shop.cart.length === 0 ? (
        <div className="empty-state">
          <ShoppingBag size={38} strokeWidth={1.2} />
          <h2>حقيبتكِ فارغة</h2>
          <p>أضيفي بعض القطع أولًا ثم عودي لإتمام الطلب.</p>
          <Link className="button" href={ROUTES.products}>تصفّحي المجموعة</Link>
        </div>
      ) : (
        <div className={styles.grid}>
          <div className={styles.panel}>
            {step === 0 && <ReviewStep onNext={() => setStep(1)} />}
            {step === 1 && <DeliveryStep onBack={() => setStep(0)} onNext={() => setStep(2)} />}
            {step === 2 && <ContactStep onBack={() => setStep(1)} onNext={() => setStep(3)} />}
            {step === 3 && <PaymentStep onBack={() => setStep(2)} />}
          </div>
          <OrderSummary />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Stepper({ step, onStep }: { step: CheckoutStep; onStep: (step: CheckoutStep) => void }) {
  return (
    <ol className={styles.stepper} aria-label="خطوات الطلب">
      {STEPS.map((item, index) => {
        const Icon = item.icon;
        const state = index < step ? "done" : index === step ? "current" : "todo";
        return (
          <li key={item.title} className={styles[state]} aria-current={state === "current" ? "step" : undefined}>
            <button type="button" onClick={() => onStep(index as CheckoutStep)} disabled={index >= step}>
              <span className={styles.stepIcon}>{state === "done" ? <Check size={15} /> : <Icon size={15} />}</span>
              <span className={styles.stepLabel}>{item.short}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepHead({ index, description }: { index: number; description: string }) {
  return <SectionHead size="compact" align="start" eyebrow={`الخطوة ${index + 1} من ${STEPS.length}`} title={STEPS[index].title} description={description} />;
}

function StepNav({ onBack, onNext, nextLabel = "المتابعة", nextDisabled = false }: { onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean }) {
  return (
    <div className={styles.nav}>
      {onBack ? <button type="button" className="button secondary" onClick={onBack}><ArrowRight size={16} /> السابق</button> : <span />}
      {onNext && <button type="button" className="button" onClick={onNext} disabled={nextDisabled}>{nextLabel} <ArrowLeft size={16} /></button>}
    </div>
  );
}

/* ------------------------------------------------------------------ step 0 */

function ReviewStep({ onNext }: { onNext: () => void }) {
  const shop = useShop();
  return (
    <section>
      <StepHead index={0} description="تأكدي من القطع والكميات قبل المتابعة." />
      <ul className={styles.reviewList}>
        {shop.cart.map((line) => (
          <li key={line.key}>
            <span className={styles.reviewThumb}><SmartImage src={line.product.primaryImageUrl} alt="" fill sizes="72px" /></span>
            <div>
              <strong>{line.product.title}</strong>
              <small>{[line.sizeLabel && `المقاس ${line.sizeLabel}`, line.colorName, `× ${line.quantity}`].filter(Boolean).join(" · ")}</small>
            </div>
            <b>{formatPrice(line.lineTotal)}</b>
          </li>
        ))}
      </ul>
      <Link href={ROUTES.cart} className={styles.editLink}>تعديل الحقيبة</Link>
      <StepNav onNext={onNext} />
    </section>
  );
}

/* ------------------------------------------------------------------ step 1 */

function DeliveryStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const form = useCheckoutStore((state) => state.form);
  const updateForm = useCheckoutStore((state) => state.updateForm);
  const zones = useDeliveryZones();
  const [errors, setErrors] = useState<FieldErrors>({});
  const selectedZone = zones.data?.find((zone) => zone.id === form.deliveryZoneId);

  const next = () => {
    const parsed = deliverySchema.safeParse(form);
    if (!parsed.success) { setErrors(zodErrors(parsed.error)); return; }
    setErrors({});
    onNext();
  };

  return (
    <section>
      <StepHead index={1} description="هل تحتاجين توصيلًا إلى عنوانكِ أم تفضّلين الاستلام بالتنسيق معنا؟" />
      <div className={styles.choice} role="radiogroup" aria-label="طريقة الاستلام">
        <button type="button" role="radio" aria-checked={form.needsDelivery} className={form.needsDelivery ? styles.choiceActive : ""} onClick={() => updateForm({ needsDelivery: true })}>
          <Truck size={20} /><span><strong>نعم، أريد التوصيل</strong><small>إلى عنوانكِ في المنطقة المختارة</small></span>
        </button>
        <button type="button" role="radio" aria-checked={!form.needsDelivery} className={!form.needsDelivery ? styles.choiceActive : ""} onClick={() => updateForm({ needsDelivery: false, deliveryZoneId: "", address: "" })}>
          <MapPin size={20} /><span><strong>لا، سأستلم بالتنسيق</strong><small>نرتّب معكِ الاستلام عبر واتساب</small></span>
        </button>
      </div>

      {form.needsDelivery && (
        <div className={styles.fields}>
          <div className="field">
            <label htmlFor="zone">منطقة التوصيل</label>
            {zones.isError ? (
              <ErrorState variant="banner" error={zones.error} onRetry={() => void zones.refetch()} retrying={zones.isRefetching} />
            ) : (
              <div className={styles.selectWrap}>
                <select id="zone" className="input" value={form.deliveryZoneId} onChange={(event) => updateForm({ deliveryZoneId: event.target.value })} aria-invalid={Boolean(errors.deliveryZoneId)} disabled={zones.isPending}>
                  <option value="">{zones.isPending ? "جارٍ تحميل المناطق..." : "اختاري المنطقة"}</option>
                  {zones.data?.map((zone) => (
                    <option value={zone.id} key={zone.id}>{zone.name}{zone.extraFee ? ` — رسوم ${formatPrice(zone.extraFee)}` : " — بدون رسوم"}</option>
                  ))}
                </select>
              </div>
            )}
            {errors.deliveryZoneId && <span className="field-error" role="alert">{errors.deliveryZoneId}</span>}
            {selectedZone && <small className={styles.hint}>{selectedZone.extraFee ? `رسوم التوصيل لهذه المنطقة ${formatPrice(selectedZone.extraFee)} تُدفع عند الاستلام.` : "التوصيل لهذه المنطقة بدون رسوم إضافية."}</small>}
          </div>
          <div className="field">
            <label htmlFor="address">العنوان بالتفصيل</label>
            <textarea id="address" className="input" rows={3} value={form.address} onChange={(event) => updateForm({ address: event.target.value })} placeholder="المدينة، الحي، الشارع، أقرب معلم..." aria-invalid={Boolean(errors.address)} />
            {errors.address && <span className="field-error" role="alert">{errors.address}</span>}
          </div>
        </div>
      )}
      <StepNav onBack={onBack} onNext={next} />
    </section>
  );
}

/* ------------------------------------------------------------------ step 2 */

function ContactStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const form = useCheckoutStore((state) => state.form);
  const updateForm = useCheckoutStore((state) => state.updateForm);
  const [errors, setErrors] = useState<FieldErrors>({});

  const next = () => {
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) { setErrors(zodErrors(parsed.error)); return; }
    setErrors({});
    updateForm({ phoneNumber: parsed.data.phoneNumber, customerName: parsed.data.customerName });
    onNext();
  };

  return (
    <section>
      <StepHead index={2} description="نستخدم رقم الواتساب لتأكيد الطلب وموعد التوصيل فقط." />
      <div className={styles.fields}>
        <div className="field">
          <label htmlFor="name">الاسم الكامل</label>
          <input id="name" className="input" autoComplete="name" value={form.customerName} onChange={(event) => updateForm({ customerName: event.target.value })} aria-invalid={Boolean(errors.customerName)} />
          {errors.customerName && <span className="field-error" role="alert">{errors.customerName}</span>}
        </div>
        <div className="field">
          <label htmlFor="phone">رقم الواتساب</label>
          <div className={styles.phoneRow}>
            <select className="input" aria-label="رمز الدولة" value={form.whatsAppCountryCode} onChange={(event) => updateForm({ whatsAppCountryCode: event.target.value as CheckoutForm["whatsAppCountryCode"] })}>
              <option value="970">+970</option>
              <option value="972">+972</option>
            </select>
            <input id="phone" className="input" inputMode="numeric" autoComplete="tel-national" dir="ltr" placeholder="59 999 9999" value={form.phoneNumber} onChange={(event) => updateForm({ phoneNumber: event.target.value.replace(/[^\d\s]/g, "") })} aria-invalid={Boolean(errors.phoneNumber)} />
          </div>
          {errors.phoneNumber ? <span className="field-error" role="alert">{errors.phoneNumber}</span> : <small className={styles.hint}>اكتبيه بدون الصفر في البداية، مثل 599999999</small>}
        </div>
      </div>
      <StepNav onBack={onBack} onNext={next} />
    </section>
  );
}

/* ------------------------------------------------------------------ step 3 */

function PaymentStep({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const shop = useShop();
  const online = useOnlineStatus();
  const form = useCheckoutStore((state) => state.form);
  const updateForm = useCheckoutStore((state) => state.updateForm);
  const appliedDiscount = useCheckoutStore((state) => state.appliedDiscount);
  const setAppliedDiscount = useCheckoutStore((state) => state.setAppliedDiscount);
  const resetCheckout = useCheckoutStore((state) => state.reset);
  const idempotency = useIdempotencyKey();
  const createOrder = useCreateOrder();
  const validateDiscount = useValidateDiscountCode();
  const [discountMessage, setDiscountMessage] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(true);

  // A discount validated against a different subtotal is stale.
  const discount = appliedDiscount && appliedDiscount.subtotal === shop.subtotal ? appliedDiscount : null;
  const total = Math.max(0, shop.subtotal - (discount?.amount ?? 0));
  const submitting = createOrder.isPending;

  const applyDiscount = async () => {
    const code = form.discountCode.trim().toUpperCase();
    if (!code) return;
    setDiscountMessage(null);
    try {
      const result = await validateDiscount.mutateAsync({ code, subtotal: shop.subtotal });
      if (result.isValid) {
        setAppliedDiscount({ code, amount: result.discountAmount, subtotal: shop.subtotal });
        setDiscountMessage(`تم تطبيق الكود — خصم ${formatPrice(result.discountAmount)}`);
      } else {
        setAppliedDiscount(null);
        setDiscountMessage("هذا الكود غير صالح أو منتهي.");
      }
    } catch {
      setAppliedDiscount(null);
      setDiscountMessage("تعذّر التحقق من الكود الآن، يمكنكِ المتابعة بدونه أو المحاولة لاحقًا.");
    }
  };

  const removeDiscount = () => {
    setAppliedDiscount(null);
    updateForm({ discountCode: "" });
    setDiscountMessage(null);
  };

  const submit = async () => {
    if (submitting || !online || !accepted || shop.cart.length === 0) return;
    const key = idempotency.getKey();
    try {
      const response = await createOrder.mutateAsync({
        idempotencyKey: key,
        request: {
          items: shop.cart.map((line) => ({ productId: line.product.id, sizeId: line.sizeId, colorId: line.colorId, quantity: line.quantity })),
          needsDelivery: form.needsDelivery,
          deliveryZoneId: form.needsDelivery ? form.deliveryZoneId || null : null,
          address: form.needsDelivery ? form.address.trim() || null : null,
          customerName: form.customerName.trim(),
          phoneNumber: normalizePhoneNumber(form.phoneNumber),
          whatsAppCountryCode: form.whatsAppCountryCode,
          discountCode: discount?.code ?? null,
        },
      });
      // Only now — after the server confirmed — do we clear state and show success.
      shop.clearCart();
      resetCheckout();
      idempotency.clear();
      router.push(`${ROUTES.orderSuccess(response.invoiceNumber)}?total=${encodeURIComponent(response.total)}`);
    } catch {
      // Error is rendered below from `createOrder.error`; the idempotency key is kept for retry.
    }
  };

  const serverFieldErrors = createOrder.error instanceof AppError ? createOrder.error.fieldErrors : undefined;
  const outOfStock = createOrder.error instanceof AppError && createOrder.error.code === "OUT_OF_STOCK";

  return (
    <section>
      <StepHead index={3} description="الدفع نقدًا عند الاستلام. راجعي التفاصيل ثم أكّدي طلبكِ." />

      <div className={styles.payment}>
        <span className={styles.paymentIcon}><Banknote size={20} /></span>
        <div><strong>الدفع عند الاستلام</strong><small>تدفعين نقدًا عند تسلّم القطع — لا حاجة لبطاقة.</small></div>
        <Check size={18} className={styles.paymentCheck} />
      </div>

      <div className="field">
        <label htmlFor="discount">كود الخصم (اختياري)</label>
        <div className={styles.discountRow}>
          <input id="discount" className="input" dir="ltr" placeholder="RIVAL10" value={form.discountCode} disabled={Boolean(discount) || submitting} onChange={(event) => updateForm({ discountCode: event.target.value.toUpperCase() })} />
          {discount ? (
            <button type="button" className="button secondary" onClick={removeDiscount} disabled={submitting}><X size={15} /> إزالة</button>
          ) : (
            <button type="button" className="button secondary" onClick={() => void applyDiscount()} disabled={validateDiscount.isPending || !form.discountCode.trim() || submitting}>
              {validateDiscount.isPending ? <Spinner size={15} /> : <BadgePercent size={15} />} تطبيق
            </button>
          )}
        </div>
        {discountMessage && <small className={discount ? styles.ok : "field-error"} role="status">{discountMessage}</small>}
      </div>

      <dl className={styles.recap}>
        <div><dt>الاستلام</dt><dd>{form.needsDelivery ? `توصيل — ${form.address}` : "استلام بالتنسيق عبر واتساب"}</dd></div>
        <div><dt>التواصل</dt><dd dir="ltr">{form.customerName} · +{form.whatsAppCountryCode}{normalizePhoneNumber(form.phoneNumber)}</dd></div>
      </dl>

      {serverFieldErrors && Object.keys(serverFieldErrors).length > 0 && (
        <ul className={styles.serverErrors} role="alert">
          {Object.values(serverFieldErrors).map((message) => <li key={message}>{message}</li>)}
        </ul>
      )}
      {createOrder.isError && (
        <ErrorState
          variant="banner"
          error={createOrder.error}
          onRetry={outOfStock ? undefined : () => void submit()}
          retrying={submitting}
          className={styles.submitError}
        />
      )}
      {outOfStock && <Link href={ROUTES.cart} className={styles.editLink}>مراجعة الحقيبة وتعديل الكميات</Link>}
      {!online && (
        <div className={styles.offline} role="status"><WifiOff size={16} /> لا يوجد اتصال — بياناتكِ محفوظة، وسيُفعَّل زر التأكيد فور عودة الاتصال.</div>
      )}

      <label className={styles.terms}>
        <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={submitting} />
        <span>أوافق على <Link href={POLICY_ROUTES.order}>سياسة الطلب</Link> و<Link href={POLICY_ROUTES.returns}>الاستبدال والإرجاع</Link>.</span>
      </label>

      <div className={styles.nav}>
        <button type="button" className="button secondary" onClick={onBack} disabled={submitting}><ArrowRight size={16} /> السابق</button>
        <button type="button" className={`button ${styles.submit}`} onClick={() => void submit()} disabled={submitting || !online || !accepted} aria-busy={submitting}>
          {submitting ? <><Spinner size={17} tone="inverse" /> جارٍ تأكيد الطلب...</> : <><ShieldCheck size={17} /> تأكيد الطلب · {formatPrice(total)}</>}
        </button>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function OrderSummary() {
  const shop = useShop();
  const form = useCheckoutStore((state) => state.form);
  const appliedDiscount = useCheckoutStore((state) => state.appliedDiscount);
  const zones = useDeliveryZones();
  const zone = form.needsDelivery ? zones.data?.find((item) => item.id === form.deliveryZoneId) : undefined;
  const discount = appliedDiscount && appliedDiscount.subtotal === shop.subtotal ? appliedDiscount.amount : 0;
  const total = Math.max(0, shop.subtotal - discount);
  const lines = useMemo(() => shop.cart.slice(0, 4), [shop.cart]);

  return (
    <aside className={`surface ${styles.summary}`} aria-label="ملخص الطلب">
      <h2>ملخص الطلب</h2>
      <ul className={styles.summaryLines}>
        {lines.map((line) => (
          <li key={line.key}>
            <span className={styles.summaryThumb}><SmartImage src={line.product.primaryImageUrl} alt="" fill sizes="56px" /><b>{line.quantity}</b></span>
            <span className={styles.summaryTitle}>{line.product.title}</span>
            <span>{formatPrice(line.lineTotal)}</span>
          </li>
        ))}
        {shop.cart.length > lines.length && <li className={styles.summaryMore}>و{shop.cart.length - lines.length} قطع أخرى</li>}
      </ul>
      <div className={styles.row}><span>الإجمالي الفرعي</span><span>{formatPrice(shop.subtotal)}</span></div>
      {discount > 0 && <div className={`${styles.row} ${styles.ok}`}><span>الخصم</span><span>- {formatPrice(discount)}</span></div>}
      <div className={styles.row}><span>التوصيل</span><span className="muted">{!form.needsDelivery ? "استلام" : zone ? (zone.extraFee ? `${formatPrice(zone.extraFee)} عند الاستلام` : "بدون رسوم") : "يُحدد لاحقًا"}</span></div>
      <div className={`${styles.row} ${styles.total}`}><span>الإجمالي</span><strong>{formatPrice(total)}</strong></div>
      <p className={styles.secure}><ShieldCheck size={14} /> بياناتكِ محفوظة على جهازكِ حتى إتمام الطلب.</p>
    </aside>
  );
}
