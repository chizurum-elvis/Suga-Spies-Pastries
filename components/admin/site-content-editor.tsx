"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  publishSiteContent,
  restoreSiteContent,
  saveSiteContent,
  type ContentActionState,
} from "@/lib/content/actions";
import type {
  ContactContent,
  ContentKey,
  FaqContent,
  HomeContent,
  PolicyContent,
} from "@/lib/content/schema";

type EditorBody = HomeContent | ContactContent | FaqContent | PolicyContent;
type Props = {
  contentKey: ContentKey;
  version: number;
  initialBody: EditorBody;
  publishedVersion: number | null;
  history: { version: number; publishedAt: string }[];
};

const initialState: ContentActionState = {
  status: "idle",
  message: "",
  submissionId: "",
};
const policyKeys = ["terms", "privacy", "refund"];

function Field({
  label,
  value,
  onChange,
  maxLength,
  multiline = false,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  multiline?: boolean;
  type?: "text" | "email" | "tel";
  required?: boolean;
}) {
  const classes =
    "border-border focus-visible:outline-brand mt-2 block min-h-11 w-full border bg-white px-3 py-2.5 text-sm leading-6 font-normal focus-visible:outline-2 focus-visible:outline-offset-2";
  return (
    <label className="text-ink block text-sm font-semibold">
      {label}
      {multiline ? (
        <textarea
          className={`${classes} min-h-28 resize-y`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          required={required}
          rows={maxLength > 5000 ? 15 : 4}
        />
      ) : (
        <input
          className={classes}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          required={required}
          autoComplete={
            type === "email" ? "email" : type === "tel" ? "tel" : "off"
          }
        />
      )}
    </label>
  );
}

export function SiteContentEditor({
  contentKey,
  version,
  initialBody,
  publishedVersion,
  history,
}: Props) {
  const router = useRouter();
  const [body, setBody] = useState<EditorBody>(initialBody);
  const [saveState, saveAction, saving] = useActionState(
    saveSiteContent,
    initialState,
  );
  const [publishState, publishAction, publishing] = useActionState(
    publishSiteContent,
    initialState,
  );
  const [restoreState, restoreAction, restoring] = useActionState(
    restoreSiteContent,
    initialState,
  );
  const dirty = JSON.stringify(body) !== JSON.stringify(initialBody);
  const isPolicy = policyKeys.includes(contentKey);

  useEffect(() => {
    if (saveState.status === "success") router.refresh();
  }, [router, saveState.status, saveState.submissionId]);
  useEffect(() => {
    if (publishState.status === "success") router.refresh();
  }, [router, publishState.status, publishState.submissionId]);
  useEffect(() => {
    if (restoreState.status === "success") router.refresh();
  }, [router, restoreState.status, restoreState.submissionId]);

  let fields;
  let preview;
  if (contentKey === "home") {
    const home = body as HomeContent;
    fields = (
      <>
        <Field
          label="Announcement (optional)"
          value={home.announcement}
          maxLength={160}
          required={false}
          onChange={(announcement) => setBody({ ...home, announcement })}
        />
        <p className="text-ink-soft text-xs leading-5">
          Shown above the navigation. Leave it empty to hide the announcement
          bar.
        </p>
        <Field
          label="Welcome heading"
          value={home.heroTitle}
          maxLength={100}
          onChange={(heroTitle) => setBody({ ...home, heroTitle })}
        />
        <Field
          label="Welcome description"
          value={home.heroDescription}
          maxLength={350}
          multiline
          onChange={(heroDescription) => setBody({ ...home, heroDescription })}
        />
        <Field
          label="Pastry story heading"
          value={home.storyTitle}
          maxLength={100}
          onChange={(storyTitle) => setBody({ ...home, storyTitle })}
        />
        <Field
          label="Pastry story copy"
          value={home.storyBody}
          maxLength={700}
          multiline
          onChange={(storyBody) => setBody({ ...home, storyBody })}
        />
      </>
    );
    preview = (
      <div className="space-y-3">
        {home.announcement ? (
          <p className="bg-brand px-3 py-2 text-center text-xs text-white">
            {home.announcement}
          </p>
        ) : null}
        <h3 className="font-display text-2xl">
          {home.heroTitle || "Welcome heading"}
        </h3>
        <p className="text-ink-soft text-sm leading-6">
          {home.heroDescription}
        </p>
        <h4 className="font-display pt-3 text-xl">{home.storyTitle}</h4>
        <p className="text-ink-soft text-sm leading-6">{home.storyBody}</p>
      </div>
    );
  } else if (contentKey === "contact") {
    const contact = body as ContactContent;
    fields = (
      <>
        <Field
          label="Public support phone"
          type="tel"
          value={contact.phone}
          maxLength={40}
          onChange={(phone) => setBody({ ...contact, phone })}
        />
        <Field
          label="Support email (optional)"
          type="email"
          required={false}
          value={contact.email}
          maxLength={254}
          onChange={(email) => setBody({ ...contact, email })}
        />
        <p className="text-ink-soft text-xs leading-5">
          Only enter contact details you want customers to see. Never enter the
          private business or home address here.
        </p>
      </>
    );
    preview = (
      <p className="text-sm">
        Call {contact.phone}
        {contact.email ? ` · Email ${contact.email}` : ""}
      </p>
    );
  } else if (contentKey === "faq") {
    const faq = body as FaqContent;
    const change = (
      index: number,
      name: "question" | "answer",
      value: string,
    ) =>
      setBody({
        items: faq.items.map((item, position) =>
          position === index ? { ...item, [name]: value } : item,
        ),
      });
    fields = (
      <>
        {faq.items.map((item, index) => (
          <fieldset
            key={index}
            className="border-border min-w-0 space-y-4 border p-4"
          >
            <legend className="text-ink px-1 text-sm font-bold">
              Question {index + 1}
            </legend>
            <Field
              label="Question"
              value={item.question}
              maxLength={180}
              onChange={(value) => change(index, "question", value)}
            />
            <Field
              label="Answer"
              value={item.answer}
              maxLength={800}
              multiline
              onChange={(value) => change(index, "answer", value)}
            />
            <button
              type="button"
              disabled={faq.items.length <= 1}
              onClick={() =>
                setBody({
                  items: faq.items.filter((_, position) => position !== index),
                })
              }
              className="text-brand-strong min-h-11 text-sm font-bold underline disabled:opacity-50"
            >
              Remove question {index + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={faq.items.length >= 12}
          onClick={() =>
            setBody({ items: [...faq.items, { question: "", answer: "" }] })
          }
          className="border-brand text-brand-strong min-h-11 border px-4 text-sm font-bold disabled:opacity-50"
        >
          Add a question
        </button>
      </>
    );
    preview = (
      <div className="space-y-2">
        {faq.items.map((item, index) => (
          <details key={index} className="border-border border-b py-3">
            <summary className="cursor-pointer font-semibold">
              {item.question || "Untitled question"}
            </summary>
            <p className="text-ink-soft pt-3 text-sm leading-6">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    );
  } else {
    const policy = body as PolicyContent;
    fields = (
      <>
        <Field
          label="Page title"
          value={policy.title}
          maxLength={120}
          onChange={(title) => setBody({ ...policy, title })}
        />
        <Field
          label="Policy text"
          value={policy.body}
          maxLength={20000}
          multiline
          required={false}
          onChange={(text) => setBody({ ...policy, body: text })}
        />
        <p className="text-ink-soft text-xs leading-5">
          Plain text only. Use blank lines between paragraphs. A draft is not a
          checkout policy.
        </p>
      </>
    );
    preview = (
      <div>
        <h3 className="font-display text-2xl">{policy.title}</h3>
        <p className="text-ink-soft mt-4 text-sm leading-7 whitespace-pre-wrap">
          {policy.body || "Policy text has not been supplied."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
      <div className="space-y-6">
        <section
          className="border-border border bg-white p-4 sm:p-6"
          aria-labelledby="draft-heading"
        >
          <h2 id="draft-heading" className="text-ink text-xl font-bold">
            Private draft
          </h2>
          <p className="text-ink-soft mt-1 text-sm">
            Draft version {version}. Saving does not change the website.
          </p>
          <form action={saveAction} className="mt-6 space-y-5">
            <input type="hidden" name="key" value={contentKey} />
            <input type="hidden" name="version" value={version} />
            <input type="hidden" name="body" value={JSON.stringify(body)} />
            {fields}
            <button
              disabled={saving || !dirty}
              className="bg-brand hover:bg-brand-strong min-h-11 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <p
              role="status"
              className={
                saveState.status === "error"
                  ? "text-sm text-red-800"
                  : "text-ink-soft text-sm"
              }
            >
              {saveState.message}
            </p>
          </form>
        </section>
        <section
          className="border-border border bg-white p-4 sm:p-6"
          aria-labelledby="publish-heading"
        >
          <h2 id="publish-heading" className="text-ink text-xl font-bold">
            Publish saved draft
          </h2>
          <p className="text-ink-soft mt-2 text-sm leading-6">
            Publishing makes the saved version public. Unsaved changes above are
            never included.
          </p>
          <form action={publishAction} className="mt-4 space-y-4">
            <input type="hidden" name="key" value={contentKey} />
            <input type="hidden" name="version" value={version} />
            {isPolicy ? (
              <label className="flex min-h-11 items-start gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  name="approved"
                  value="yes"
                  required
                  className="accent-brand mt-1 size-5 shrink-0"
                />
                I have reviewed and approved this final policy wording for
                customers and checkout.
              </label>
            ) : null}
            <button
              disabled={publishing || dirty}
              className="border-brand text-brand-strong hover:bg-brand-soft min-h-11 border px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {publishing
                ? "Publishing…"
                : publishedVersion === version
                  ? "Refresh public pages"
                  : "Publish version"}
            </button>
            {publishedVersion === version && !dirty ? (
              <p className="text-ink-soft text-xs leading-5">
                This version is already published. Refreshing keeps its content
                and history unchanged.
              </p>
            ) : null}
            {dirty ? (
              <p className="text-ink-soft text-xs">
                Save your changes before publishing.
              </p>
            ) : null}
            <p
              role="status"
              className={
                publishState.status === "error"
                  ? "text-sm text-red-800"
                  : "text-ink-soft text-sm"
              }
            >
              {publishState.message}
            </p>
          </form>
        </section>
      </div>
      <aside className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
        <section
          className="border-border bg-canvas-strong border p-4 sm:p-6"
          aria-labelledby="preview-heading"
        >
          <p className="text-brand text-xs font-bold tracking-[0.12em] uppercase">
            Preview only
          </p>
          <h2 id="preview-heading" className="text-ink mt-2 text-lg font-bold">
            How this draft reads
          </h2>
          <div className="border-border mt-5 border-t pt-5">{preview}</div>
        </section>
        {history.length ? (
          <section
            className="border-border border bg-white p-4 sm:p-6"
            aria-labelledby="history-heading"
          >
            <h2 id="history-heading" className="text-ink text-lg font-bold">
              Published history
            </h2>
            <p className="text-ink-soft mt-1 text-xs leading-5">
              Restoring copies an earlier public version into a new private
              draft. It does not publish automatically.
            </p>
            <ul className="border-border mt-4 divide-y border-t">
              {history.map((item) => (
                <li
                  key={item.version}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <span>
                    Version {item.version}
                    {publishedVersion === item.version ? " · current" : ""}
                    <span className="text-ink-soft block text-xs">
                      {new Date(item.publishedAt).toLocaleDateString("en-CA", {
                        timeZone: "America/Toronto",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </span>
                  <form action={restoreAction}>
                    <input type="hidden" name="key" value={contentKey} />
                    <input type="hidden" name="version" value={version} />
                    <input
                      type="hidden"
                      name="sourceVersion"
                      value={item.version}
                    />
                    <button
                      disabled={restoring || dirty}
                      className="text-brand-strong min-h-11 text-xs font-bold underline disabled:opacity-50"
                    >
                      Restore as draft
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <p
              role="status"
              className={
                restoreState.status === "error"
                  ? "text-sm text-red-800"
                  : "text-ink-soft text-sm"
              }
            >
              {restoreState.message}
            </p>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
