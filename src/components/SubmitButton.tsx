"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({
  children, className = "btn-primary", confirmText,
}: { children: React.ReactNode; className?: string; confirmText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}
