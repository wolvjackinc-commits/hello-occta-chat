import { Link, useLocation } from "react-router-dom";
import { TOPIC_LINKS } from "@/lib/seo/topicCanonicals";
import { normalizePublicPath } from "@/lib/seo/normalizePath";

/** Points overlapping guides at the one primary URL for that topic. */
export default function TopicCrosslink() {
  const location = useLocation();
  const topic = TOPIC_LINKS[normalizePublicPath(location.pathname)];
  if (!topic) return null;

  return (
    <p className="border-b border-foreground/10 bg-secondary px-4 py-2 text-center text-sm text-muted-foreground">
      Main page for this topic:{" "}
      <Link to={topic.to} className="font-medium text-foreground underline">
        {topic.label}
      </Link>
    </p>
  );
}
