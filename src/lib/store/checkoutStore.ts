import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "@/lib/utils/safeStorage";
import type { WhatsAppCountryCode } from "@/lib/utils/formatPhone";

export type CheckoutStep = 0 | 1 | 2 | 3;

export interface CheckoutForm {
  needsDelivery: boolean;
  deliveryZoneId: string;
  address: string;
  customerName: string;
  whatsAppCountryCode: WhatsAppCountryCode;
  phoneNumber: string;
  discountCode: string;
}

export interface AppliedDiscount {
  code: string;
  amount: number;
  /** Subtotal the discount was validated against; re-validated if the cart changes. */
  subtotal: number;
}

interface CheckoutState {
  step: CheckoutStep;
  form: CheckoutForm;
  appliedDiscount: AppliedDiscount | null;
  /** Idempotency key for the order currently being placed; reused on retry, cleared on success. */
  idempotencyKey: string | null;
  setStep: (step: CheckoutStep) => void;
  updateForm: (patch: Partial<CheckoutForm>) => void;
  setAppliedDiscount: (discount: AppliedDiscount | null) => void;
  setIdempotencyKey: (key: string | null) => void;
  reset: () => void;
}

export const EMPTY_CHECKOUT_FORM: CheckoutForm = {
  needsDelivery: true,
  deliveryZoneId: "",
  address: "",
  customerName: "",
  whatsAppCountryCode: "970",
  phoneNumber: "",
  discountCode: "",
};

const STORAGE_KEY = "rival-checkout";

/** Persisted so a failed submit, refresh, or lost connection never loses customer input. */
export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      step: 0,
      form: EMPTY_CHECKOUT_FORM,
      appliedDiscount: null,
      idempotencyKey: null,
      setStep: (step) => set({ step }),
      updateForm: (patch) => set((state) => ({ form: { ...state.form, ...patch } })),
      setAppliedDiscount: (appliedDiscount) => set({ appliedDiscount }),
      setIdempotencyKey: (idempotencyKey) => set({ idempotencyKey }),
      reset: () => set({ step: 0, form: EMPTY_CHECKOUT_FORM, appliedDiscount: null, idempotencyKey: null }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        step: state.step,
        form: state.form,
        appliedDiscount: state.appliedDiscount,
        idempotencyKey: state.idempotencyKey,
      }),
    },
  ),
);
