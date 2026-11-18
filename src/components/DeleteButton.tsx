import { deleteRow } from "@/lib/actions";
import SubmitButton from "./SubmitButton";

export default function DeleteButton({ table, id, back }: { table: string; id: string; back: string }) {
  return (
    <form action={deleteRow}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <SubmitButton className="btn btn-sm text-rose-400" confirmText="¿Seguro que quieres borrarlo?">
        Borrar
      </SubmitButton>
    </form>
  );
}
