type SkipLinkProps = {
  targetId?: string;
};

export function SkipLink({ targetId = "main-content" }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="bg-ink shadow-dialog fixed top-3 left-3 z-[100] -translate-y-24 rounded-md px-4 py-3 text-sm font-bold text-white transition-transform focus:translate-y-0 motion-reduce:transition-none"
    >
      Skip to main content
    </a>
  );
}
