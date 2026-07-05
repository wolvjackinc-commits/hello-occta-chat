import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function FeedbackWidget({ articleId }: { articleId: string }) {
  const { toast } = useToast();
  const [choice, setChoice] = useState<null | boolean>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (helpful: boolean, withNote = false) => {
    setChoice(helpful);
    const { error } = await supabase.from("help_article_feedback").insert({
      article_id: articleId,
      helpful,
      note: withNote ? note.trim() || null : null,
    });
    if (error) {
      toast({ title: "Could not send feedback", description: error.message, variant: "destructive" });
      return;
    }
    setSent(true);
    toast({ title: "Thanks for the feedback" });
  };

  if (sent) {
    return (
      <section className="mt-10 border-2 border-foreground p-4 bg-secondary/40">
        <p className="font-display uppercase text-sm">Thanks — feedback logged.</p>
      </section>
    );
  }

  return (
    <section className="mt-10 border-2 border-foreground p-4">
      <p className="font-display uppercase text-sm mb-3">Was this helpful?</p>
      <div className="flex gap-2">
        <Button size="sm" variant={choice === true ? "default" : "outline"} onClick={() => submit(true)}>
          <ThumbsUp className="h-4 w-4 mr-1" /> Yes
        </Button>
        <Button size="sm" variant={choice === false ? "default" : "outline"} onClick={() => setChoice(false)}>
          <ThumbsDown className="h-4 w-4 mr-1" /> No
        </Button>
      </div>
      {choice === false && (
        <div className="mt-3 space-y-2">
          <Textarea
            rows={3}
            placeholder="Tell us what was missing (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border-2 border-foreground"
          />
          <Button size="sm" onClick={() => submit(false, true)}>Send</Button>
        </div>
      )}
    </section>
  );
}