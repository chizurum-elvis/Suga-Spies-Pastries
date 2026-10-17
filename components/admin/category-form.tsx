"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { suggestCatalogueSlug } from "@/lib/catalog/slug";
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
  const [slug, setSlug] = useState("");
  const [customSlug, setCustomSlug] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previous: CatalogueActionState, form: FormData) => {
      const next = await action(previous, form);
      if (next.status === "success") {
        setSlug("");
        setCustomSlug(false);
      }
      return next;
    },
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
          {(props) => (
            <Input
              {...props}
              name="name"
              maxLength={80}
              required
              onChange={(event) => {
                if (!customSlug)
                  setSlug(suggestCatalogueSlug(event.target.value, 80));
              }}
            />
          )}
        </Field>
        <Field
          id="category-slug"
          label="Website page address"
          description="Suggested from the name. You can leave it as it is."
          required
        >
          {(props) => (
            <Input
              {...props}
              name="slug"
              maxLength={80}
              placeholder="celebration-cakes"
              value={slug}
              onChange={(event) => {
                setCustomSlug(true);
                setSlug(event.target.value);
              }}
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
