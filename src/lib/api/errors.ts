import axios from "axios";
import type { ApiErrorResponse } from "@/types/api.types";

/* -------------------------------------------------------------------------- */
/*  AppError                                                                   */
/* -------------------------------------------------------------------------- */

export type ErrorAction = "retry" | "refresh" | "back" | "login" | "support" | "none";

export interface ErrorDescription {
  /** Short Arabic headline (safe to show to customers). */
  title: string;
  /** Arabic explanation with no technical details. */
  message: string;
  /** Recommended primary action for the UI. */
  action: ErrorAction;
  isRetryable: boolean;
}

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly correlationId: string | null = null,
    public readonly status: number | null = null,
    public readonly fieldErrors?: Record<string, string>,
    public readonly method: string | null = null,
  ) {
    super(message);
    this.name = "AppError";
  }

  get description(): ErrorDescription {
    return describeError(this);
  }
}

/* -------------------------------------------------------------------------- */
/*  Catalogue of customer-facing messages                                      */
/* -------------------------------------------------------------------------- */

const UNKNOWN: ErrorDescription = {
  title: "حدث خطأ غير متوقع",
  message: "لم نتمكن من إتمام العملية. حاولي مجددًا بعد لحظات.",
  action: "retry",
  isRetryable: true,
};

/** Messages keyed by the backend `errorCode` (takes precedence over the HTTP status). */
const BY_CODE: Record<string, ErrorDescription> = {
  NETWORK_OFFLINE: {
    title: "لا يوجد اتصال بالإنترنت",
    message: "تحققي من اتصالكِ ثم أعيدي المحاولة. احتفظنا باختياراتكِ كما هي.",
    action: "retry",
    isRetryable: true,
  },
  NETWORK_ERROR: {
    title: "تعذّر الوصول إلى الخدمة",
    message: "يبدو أن الاتصال غير مستقر. أعيدي المحاولة خلال لحظات.",
    action: "retry",
    isRetryable: true,
  },
  TIMEOUT: {
    title: "استغرق الطلب وقتًا أطول من المعتاد",
    message: "لم نتلقَّ ردًا في الوقت المناسب. أعيدي المحاولة، وإن تكرر الأمر جرّبي لاحقًا.",
    action: "retry",
    isRetryable: true,
  },
  CANCELLED: {
    title: "تم إلغاء الطلب",
    message: "أُلغي الطلب قبل اكتماله.",
    action: "none",
    isRetryable: true,
  },
  BAD_REQUEST: {
    title: "تعذّر فهم الطلب",
    message: "تحققي من البيانات المدخلة وحاولي مجددًا.",
    action: "back",
    isRetryable: false,
  },
  SEARCH_TOO_LONG: {
    title: "كلمة البحث طويلة جدًا",
    message: "استخدمي كلمات أقصر (حتى 100 حرف) للحصول على نتائج أفضل.",
    action: "none",
    isRetryable: false,
  },
  UNAUTHORIZED: {
    title: "انتهت الجلسة",
    message: "يرجى تسجيل الدخول مجددًا للمتابعة.",
    action: "login",
    isRetryable: false,
  },
  FORBIDDEN: {
    title: "غير مسموح بهذا الإجراء",
    message: "لا تملكين صلاحية الوصول إلى هذا المحتوى.",
    action: "back",
    isRetryable: false,
  },
  NOT_FOUND: {
    title: "لم نجد ما تبحثين عنه",
    message: "ربما تم نقل هذه الصفحة أو لم تعد القطعة متاحة.",
    action: "back",
    isRetryable: false,
  },
  CONFLICT: {
    title: "تغيّرت البيانات أثناء العملية",
    message: "حدّثي الصفحة ثم أعيدي المحاولة.",
    action: "refresh",
    isRetryable: true,
  },
  OUT_OF_STOCK: {
    title: "إحدى القطع لم تعد متوفرة",
    message: "نفدت كمية قطعة أو مقاس في حقيبتكِ. عدّلي الحقيبة ثم أكملي الطلب.",
    action: "back",
    isRetryable: false,
  },
  DUPLICATE_REQUEST: {
    title: "تم استلام طلبكِ مسبقًا",
    message: "يبدو أن هذا الطلب أُرسل من قبل. تحققي من رسائل واتساب أو تواصلي معنا للتأكيد.",
    action: "support",
    isRetryable: false,
  },
  INVOICE_LOCKED: {
    title: "لا يمكن تعديل هذه الفاتورة",
    message: "انتهت فترة التعديل المسموح بها لهذه الفاتورة.",
    action: "back",
    isRetryable: false,
  },
  VALIDATION_ERROR: {
    title: "يرجى مراجعة البيانات",
    message: "بعض الحقول تحتاج إلى تصحيح قبل المتابعة.",
    action: "none",
    isRetryable: false,
  },
  RATE_LIMITED: {
    title: "محاولات كثيرة خلال وقت قصير",
    message: "انتظري قليلًا ثم أعيدي المحاولة.",
    action: "retry",
    isRetryable: true,
  },
  DEVICE_BLOCKED: {
    title: "تعذّر إتمام الطلب من هذا الجهاز",
    message: "يرجى التواصل معنا عبر واتساب لإتمام طلبكِ يدويًا.",
    action: "support",
    isRetryable: false,
  },
  INTERNAL_ERROR: {
    title: "حدث خلل مؤقت",
    message: "نعمل على معالجته. أعيدي المحاولة بعد لحظات.",
    action: "retry",
    isRetryable: true,
  },
  EMAIL_FAILED: {
    title: "تعذّر إرسال الرسالة",
    message: "لم نتمكن من إرسال البريد الآن. أعيدي المحاولة بعد قليل.",
    action: "retry",
    isRetryable: true,
  },
  SERVICE_UNAVAILABLE: {
    title: "الخدمة غير متاحة مؤقتًا",
    message: "نقوم بأعمال صيانة قصيرة. عودي بعد دقائق.",
    action: "retry",
    isRetryable: true,
  },
  GATEWAY_TIMEOUT: {
    title: "تأخر الرد من الخدمة",
    message: "استغرقت العملية وقتًا أطول من المتوقع. أعيدي المحاولة.",
    action: "retry",
    isRetryable: true,
  },
  UNKNOWN_ERROR: UNKNOWN,
};

/** Fallback messages keyed by HTTP status when the body carries no known `errorCode`. */
const BY_STATUS: Record<number, ErrorDescription> = {
  400: BY_CODE.BAD_REQUEST,
  401: BY_CODE.UNAUTHORIZED,
  403: BY_CODE.FORBIDDEN,
  404: BY_CODE.NOT_FOUND,
  409: BY_CODE.CONFLICT,
  422: BY_CODE.VALIDATION_ERROR,
  429: BY_CODE.RATE_LIMITED,
  500: BY_CODE.INTERNAL_ERROR,
  502: {
    title: "تعذّر الاتصال بالخدمة",
    message: "حدث خلل في الاتصال بخوادمنا. أعيدي المحاولة بعد لحظات.",
    action: "retry",
    isRetryable: true,
  },
  503: BY_CODE.SERVICE_UNAVAILABLE,
  504: BY_CODE.GATEWAY_TIMEOUT,
};

const STATUS_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_ERROR",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
  504: "GATEWAY_TIMEOUT",
};

/* -------------------------------------------------------------------------- */
/*  Public helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Resolves any thrown value to a customer-safe description. Never leaks technical details. */
export function describeError(error: unknown): ErrorDescription {
  const appError = toAppError(error);
  const byCode = BY_CODE[appError.code];
  if (byCode) return byCode;
  if (appError.status !== null) {
    const byStatus = BY_STATUS[appError.status];
    if (byStatus) return byStatus;
    if (appError.status >= 500) return BY_CODE.INTERNAL_ERROR;
  }
  return UNKNOWN;
}

export function isNotFoundError(error: unknown): boolean {
  const appError = toAppError(error);
  return appError.code === "NOT_FOUND" || appError.status === 404;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ApiErrorResponse>;
  return candidate.success === false && typeof candidate.errorCode === "string";
}

function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (!axios.isAxiosError(error)) {
    if (error instanceof Error && error.name === "AbortError") {
      return new AppError("CANCELLED", BY_CODE.CANCELLED.message);
    }
    return new AppError("UNKNOWN_ERROR", UNKNOWN.message);
  }

  const method = error.config?.method?.toUpperCase() ?? null;

  if (axios.isCancel(error) || error.code === "ERR_CANCELED") {
    return new AppError("CANCELLED", BY_CODE.CANCELLED.message, null, null, undefined, method);
  }

  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return new AppError("TIMEOUT", BY_CODE.TIMEOUT.message, null, null, undefined, method);
  }

  if (!error.response) {
    const offline = isBrowserOffline();
    const code = offline ? "NETWORK_OFFLINE" : "NETWORK_ERROR";
    return new AppError(code, BY_CODE[code].message, null, null, undefined, method);
  }

  const status = error.response.status;
  const payload: unknown = error.response.data;
  const correlationHeader = error.response.headers?.["x-correlation-id"];
  const correlationId = isApiErrorResponse(payload) && typeof payload.correlationId === "string"
    ? payload.correlationId
    : typeof correlationHeader === "string"
      ? correlationHeader
      : null;

  if (isApiErrorResponse(payload)) {
    const known = BY_CODE[payload.errorCode] ?? BY_STATUS[status];
    return new AppError(
      payload.errorCode,
      (known ?? UNKNOWN).message,
      correlationId,
      status,
      payload.fieldErrors,
      method,
    );
  }

  const code = STATUS_CODES[status] ?? (status >= 500 ? "INTERNAL_ERROR" : "UNKNOWN_ERROR");
  const known = BY_STATUS[status] ?? (status >= 500 ? BY_CODE.INTERNAL_ERROR : UNKNOWN);
  return new AppError(code, known.message, correlationId, status, undefined, method);
}
