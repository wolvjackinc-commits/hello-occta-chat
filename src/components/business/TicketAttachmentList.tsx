import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Eye, Paperclip, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BUCKET = "business-ticket-attachments";

type Attachment = {
  name: string;
  fullPath: string;
  size: number | null;
  updatedAt: string | null;
};

interface Props {
  ticketId: string;
  ticketOwnerId: string;
}

/** Lists attachments for a business ticket with preview + download and access logging. */
export const TicketAttachmentList = ({ ticketId, ticketOwnerId }: Props) => {
  const { toast } = useToast();
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ url: string; name: string; kind: "image" | "pdf" | "other" } | null>(null);

  useEffect(() => {
    const prefix = `${ticketOwnerId}/${ticketId}`;
    setLoading(true);
    supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 100, sortBy: { column: "created_at", order: "desc" } })
      .then(({ data, error }) => {
        if (error) console.warn(error.message);
        const rows: Attachment[] = (data ?? [])
          .filter((f) => !!f.name)
          .map((f) => ({
            name: f.name,
            fullPath: `${prefix}/${f.name}`,
            size: (f.metadata as any)?.size ?? null,
            updatedAt: f.updated_at ?? null,
          }));
        setItems(rows);
        setLoading(false);
      });
  }, [ticketId, ticketOwnerId]);

  const logAccess = async (fileName: string, action: "preview" | "download") => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("business_ticket_activity" as any).insert({
      ticket_id: ticketId,
      actor_id: u.user?.id ?? null,
      actor_type: "customer",
      event_type: "attachment_access",
      metadata: { file_name: fileName, action },
    });
  };

  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Could not access file", description: error?.message, variant: "destructive" });
      return null;
    }
    return data.signedUrl;
  };

  const onPreview = async (a: Attachment) => {
    const url = await getSignedUrl(a.fullPath);
    if (!url) return;
    const ext = a.name.split(".").pop()?.toLowerCase() ?? "";
    const kind: "image" | "pdf" | "other" =
      ["png", "jpg", "jpeg", "gif", "webp"].includes(ext) ? "image" : ext === "pdf" ? "pdf" : "other";
    if (kind === "other") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      setPreview({ url, name: a.name, kind });
    }
    logAccess(a.name, "preview");
  };

  const onDownload = async (a: Attachment) => {
    const url = await getSignedUrl(a.fullPath);
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = a.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logAccess(a.name, "download");
  };

  const humanSize = (n: number | null) => {
    if (!n) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading attachments…
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No attachments on this ticket.</p>;
  }

  return (
    <>
      <ul className="space-y-2">
        {items.map((a) => (
          <li
            key={a.fullPath}
            className="flex items-center justify-between gap-3 border-2 border-foreground/20 p-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Paperclip className="w-4 h-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-sm truncate">{a.name}</div>
                <div className="text-[10px] text-muted-foreground uppercase">{humanSize(a.size)}</div>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => onPreview(a)} aria-label="Preview">
                <Eye className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDownload(a)} aria-label="Download">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview?.kind === "image" && (
            <img src={preview.url} alt="" className="max-h-[70vh] mx-auto" />
          )}
          {preview?.kind === "pdf" && (
            <iframe src={preview.url} title={preview.name} className="w-full h-[70vh] border-2 border-foreground" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TicketAttachmentList;