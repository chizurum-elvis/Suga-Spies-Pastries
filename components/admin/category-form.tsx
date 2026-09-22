"use client";

import { useActionState, useEffect, useRef } from "react";
import { FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { CatalogueActionMessage } from "@/components/admin/catalogue-action-message";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  initialCatalogueActionState,
  type CatalogueActionState,
} from "@/lib/catalog/action-state";

type CategoryAction = (
  state: CatalogueActionState,
  data: FormData,
) => Promise<CatalogueActionState>;

export function CategoryForm({ action }: { action: CategoryAction }) {
  const [state, formAction, pending] = useActionState(
    action,
    initialCatalogueActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
  }, [router, state.submissionId, state.status]);
  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <CatalogueActionMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="category-name" label="Category name" required>
          {(props) => <Input {...props} name="name" maxLength={80} required />}
        </Field>
        <Field id="category-slug" label="URL slug" required>
          {(props) => (
            <Input
              {...props}
              name="slug"
              maxLength={80}
              placeholder="celebration-cakes"
              required
            />
          )}
        </Field>
        <Field id="category-order" label="Display order" required>
          {(props) => (
            <Input
              {...props}
              name="displayOrder"
              type="number"
              min={0}
              step={1}
              defaultValue={0}
              required
            />
          )}
        </Field>
      </div>
      <Button
        type="submit"
        variant="secondary"
        isLoading={pending}
        loadingLabel="Adding category…"
        className="justify-self-start"
      >
        <FolderPlus className="size-4" aria-hidden="true" />
        Add category
      </Button>
    </form>
  );
}
