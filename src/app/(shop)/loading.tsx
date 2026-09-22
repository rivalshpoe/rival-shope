import { SectionLoader } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div className="container" style={{ minHeight: "50svh", display: "grid", placeItems: "center" }}>
      <SectionLoader label="ننسّق التفاصيل لكِ..." />
    </div>
  );
}
