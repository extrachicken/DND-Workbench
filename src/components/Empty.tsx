import { BookOpen } from "lucide-react";

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <BookOpen size={36} />
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
