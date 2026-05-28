import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, Copy, Download, Sparkles, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

import { extractTextFromFile } from "@/lib/extractText";
import { tailorResume, type TailorResult } from "@/lib/tailor";
import { downloadResumeDocx } from "@/lib/buildDocx";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "AI Resume Tailor — Optimize your resume for any job in seconds" },
      {
        name: "description",
        content:
          "Paste a job description, upload your resume, and get an ATS-optimized, tailored resume in under 2 minutes.",
      },
    ],
  }),
});

function Home() {
  const tailor = useServerFn(tailorResume);

  const [jobDescription, setJobDescription] = useState("");
  const [resumeMode, setResumeMode] = useState<"upload" | "paste">("upload");
  const [resumeText, setResumeText] = useState("");
  const [pastedResume, setPastedResume] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TailorResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveResume = resumeMode === "upload" ? resumeText : pastedResume;
  const canSubmit = !!effectiveResume.trim() && !!jobDescription.trim() && !loading && !extracting;

  const handleFile = useCallback(async (file: File) => {
    setExtracting(true);
    setFileName(file.name);
    try {
      const text = await extractTextFromFile(file);
      if (!text.trim()) throw new Error("No text could be extracted from this file.");
      setResumeText(text);
      toast.success(`Extracted ${text.length.toLocaleString()} characters from ${file.name}`);
    } catch (err) {
      setResumeText("");
      setFileName(null);
      toast.error(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setExtracting(false);
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await tailor({ data: { resumeText: effectiveResume, jobDescription } });
      setResult(res);
      toast.success("Resume tailored");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to tailor resume");
    } finally {
      setLoading(false);
    }
  };

  const onCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.resume);
    toast.success("Resume copied");
  };

  const onCopyCover = async () => {
    if (!result?.coverLetter) return;
    await navigator.clipboard.writeText(result.coverLetter);
    toast.success("Cover letter copied");
  };

  const onDownload = async () => {
    if (!result) return;
    try {
      await downloadResumeDocx(result.resume);
    } catch {
      toast.error("Failed to generate DOCX");
    }
  };

  const onDownloadCover = async () => {
    if (!result?.coverLetter) return;
    try {
      await downloadResumeDocx(result.coverLetter, "cover-letter.docx");
    } catch {
      toast.error("Failed to generate DOCX");
    }
  };

  const wordCount = useMemo(
    () => (effectiveResume.trim() ? effectiveResume.trim().split(/\s+/).length : 0),
    [effectiveResume],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-center" />

      <header className="border-b">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">AI Resume Tailor</h1>
            <p className="text-sm text-muted-foreground">
              Tailor your resume to any job description in under 2 minutes.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 grid gap-6 lg:grid-cols-2">
        {/* Inputs */}
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" /> Job Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Paste the full job description here…"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="min-h-[180px] resize-y"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {jobDescription.length.toLocaleString()} characters
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Resume</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={resumeMode} onValueChange={(v) => setResumeMode(v as "upload" | "paste")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload">Upload file</TabsTrigger>
                  <TabsTrigger value="paste">Paste text</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="mt-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition hover:bg-muted/60"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">
                      {fileName ?? "Click to upload PDF or DOCX"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {extracting
                        ? "Extracting text…"
                        : resumeText
                          ? `${resumeText.length.toLocaleString()} characters extracted`
                          : "Your file is processed locally in your browser"}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={onFileChange}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="paste" className="mt-4">
                  <Textarea
                    placeholder="Paste your resume text here…"
                    value={pastedResume}
                    onChange={(e) => setPastedResume(e.target.value)}
                    className="min-h-[200px] resize-y"
                  />
                </TabsContent>
              </Tabs>
              <p className="mt-2 text-xs text-muted-foreground">{wordCount.toLocaleString()} words</p>
            </CardContent>
          </Card>

          <Button onClick={onSubmit} disabled={!canSubmit} size="lg" className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Tailoring resume…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" /> Tailor Resume
              </>
            )}
          </Button>
        </section>

        {/* Output */}
        <section>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Tailored Resume</CardTitle>
              {result && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onCopy}>
                    <Copy className="mr-2 h-4 w-4" /> Copy
                  </Button>
                  <Button size="sm" onClick={onDownload}>
                    <Download className="mr-2 h-4 w-4" /> DOCX
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!result && !loading && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
                  <Sparkles className="mb-3 h-6 w-6" />
                  Your optimized resume will appear here.
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
                  <Loader2 className="mb-3 h-6 w-6 animate-spin" />
                  Aligning experience with the job description…
                </div>
              )}

              {result && (
                <div className="space-y-6">
                  {result.keywords.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        ATS keywords
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {result.keywords.map((k) => (
                          <Badge key={k} variant="secondary">
                            {k}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.improvements.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Improvements
                      </h3>
                      <ul className="space-y-1.5">
                        {result.improvements.map((imp, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span>{imp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Resume
                    </h3>
                    <pre className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 font-sans text-sm leading-relaxed">
                      {result.resume}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground">
          Built with Lovable AI. Your file is parsed locally; only extracted text is sent for tailoring.
        </div>
      </footer>
    </div>
  );
}
