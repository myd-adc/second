import Link from "next/link";
import { todayInKyiv } from "@/lib/schedule/today";
import StoreForm from "../_components/StoreForm";

export const dynamic = "force-dynamic";

export default function NewStorePage() {
  return (
    <main className="page">
      <Link href="/stores" className="back">
        ← Усі магазини
      </Link>
      <h1>Новий магазин</h1>
      <StoreForm today={todayInKyiv(new Date())} />
    </main>
  );
}
