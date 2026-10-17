import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUserId } from "@/lib/db/auth";
import { getStore } from "@/lib/db/stores";
import { todayInKyiv } from "@/lib/schedule/today";
import { isUuid } from "@/lib/uuid";
import DeleteStoreButton from "../../_components/DeleteStoreButton";
import { formStateFromStore } from "../../_components/form-state";
import StoreForm from "../../_components/StoreForm";

export const dynamic = "force-dynamic";

export default async function EditStorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const store = await getStore(id);
  if (!store) notFound();
  const userId = await currentUserId();

  return (
    <main className="page">
      <Link href={`/stores/${store.id}`} className="back">
        ← {store.name}
      </Link>
      <h1>Редагувати магазин</h1>
      <StoreForm initial={formStateFromStore(store)} today={todayInKyiv(new Date())} />
      {userId !== null && userId === store.createdBy && <DeleteStoreButton id={store.id} />}
    </main>
  );
}
