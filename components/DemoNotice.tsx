import { DEMO_NOTICE } from "@/lib/demo-notice";

export default function DemoNotice() {
  return (
    <div role="note" className="shrink-0 bg-amber-50 border-b border-amber-200 px-6 py-2 text-center text-xs text-amber-900">
      {DEMO_NOTICE}
    </div>
  );
}
