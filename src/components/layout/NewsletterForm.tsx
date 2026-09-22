"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpLeft, Check } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const newsletterSchema = z.object({
  email: z.string().trim().email("أدخلي بريدًا إلكترونيًا صحيحًا"),
});

type NewsletterValues = z.infer<typeof newsletterSchema>;

export function NewsletterForm() {
  const [subscribed, setSubscribed] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterValues>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: "" },
  });

  if (subscribed) {
    return <p role="status" className="newsletter-success"><Check size={16} /> تم الاشتراك، شكرًا لكِ.</p>;
  }

  return (
    <>
      <form onSubmit={handleSubmit(async () => setSubscribed(true))} noValidate>
        <label className="sr-only" htmlFor="newsletter">البريد الإلكتروني</label>
        <input id="newsletter" type="email" placeholder="بريدكِ الإلكتروني" aria-invalid={Boolean(errors.email)} {...register("email")} />
        <button type="submit" aria-label="اشتراك" disabled={isSubmitting}><ArrowUpLeft size={18} /></button>
      </form>
      {errors.email && <small role="alert" className="newsletter-error">{errors.email.message}</small>}
    </>
  );
}
