import { createServerFn } from "@tanstack/react-start";

export type TailorInput = { resumeText: string; jobDescription: string };
export type TailorResult = { resume: string; keywords: string[]; improvements: string[]; coverLetter: string };

const SYSTEM = `You are an expert resume optimizer for Data Engineering and Data roles.`;

function buildUserPrompt({ resumeText, jobDescription }: TailorInput) {
  return `INPUT:

1. Base Resume:
${resumeText}

2. Job Description:
${jobDescription}

TASK:
- Tailor the resume specifically for this role
- Keep all experiences truthful
- Rewrite bullet points to align with the job description
- Inject relevant keywords naturally for ATS optimization
- For the candidate's India experience, rewrite the entire bullet points around a project (choose a sensible, realistic one yourself) developed with the requirements mentioned in the JD. The chosen project must make sense with the technical skills in the JD and the candidate's background.
- Use strong action verbs
- Keep bullet points concise (2 lines)
- Emphasize impact, metrics, and technologies (e.g., Python, Airflow, AWS, Spark, SQL)

IMPORTANT:
- Positioning of Target Role (headline/summary should clearly position the candidate for this specific role)
- Skills Section: Not too generic and not poorly structured — group skills into clear, meaningful categories aligned with the JD
- Show Scale, Business Impact, Complexity, and Ownership in every relevant bullet
- Every bullet point must follow: Action + Tool + What + Impact
- All bullet points must make sense (no vague or filler bullets)
- Do NOT add fake experience
- Do NOT change job titles or companies
- Do NOT make it generic

OUTPUT:
Return a clean, professional, well-structured resume with:
- Summary
- Skills
- Experience (tailored bullet points)
- Projects (if present)

Also extract the top 10 ATS keywords from the job description, and list 5 concise notes describing improvements you made to the resume.

Additionally, generate a customised cover letter for this exact role based on the tailored resume and job description. The cover letter MUST:
- Sound 100% human-written, NOT AI-generated (no generic phrases like "I am writing to express my interest", "I am excited to apply", "perfect fit", "passionate about", "synergy", "leverage", "delve", "in today's fast-paced world", etc.)
- Be conversational, specific, and personal — like a real candidate wrote it
- Reference 2-3 concrete achievements/projects from the resume that map directly to the JD's requirements
- Mention specific tools/technologies from the JD naturally
- Be 3-4 short paragraphs, ~250-350 words
- Open with a strong, non-generic hook (not "Dear Hiring Manager, I am applying for...")
- Avoid clichés, buzzwords, em-dashes overuse, and overly formal/robotic tone
- Use varied sentence lengths and natural transitions
- Close with a confident, specific call to action (not "I look forward to hearing from you")
- Use "Dear Hiring Manager," as the greeting unless a name is inferable from the JD`;
}

export const tailorResume = createServerFn({ method: "POST" })
  .inputValidator((data: TailorInput) => {
    if (!data?.resumeText?.trim()) throw new Error("Resume text is required");
    if (!data?.jobDescription?.trim()) throw new Error("Job description is required");
    if (data.resumeText.length > 60000) throw new Error("Resume is too long");
    if (data.jobDescription.length > 30000) throw new Error("Job description is too long");
    return data;
  })
  .handler(async ({ data }): Promise<TailorResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: buildUserPrompt(data) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_tailored_resume",
              description: "Return the tailored resume plus extracted keywords and improvements.",
              parameters: {
                type: "object",
                properties: {
                  resume: {
                    type: "string",
                    description:
                      "The full tailored resume as plain text with clear section headers (SUMMARY, SKILLS, EXPERIENCE, PROJECTS). Use bullet points starting with '- '.",
                  },
                  keywords: {
                    type: "array",
                    items: { type: "string" },
                    description: "Top 10 ATS keywords extracted from the job description.",
                  },
                  improvements: {
                    type: "array",
                    items: { type: "string" },
                    description: "5 short notes describing improvements made to the resume.",
                  },
                  coverLetter: {
                    type: "string",
                    description:
                      "A customised, human-sounding cover letter (250-350 words, 3-4 paragraphs) tailored to the JD and resume. Must not sound AI-generated.",
                  },
                },
                required: ["resume", "keywords", "improvements", "coverLetter"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_tailored_resume" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit reached. Please wait a moment and try again.");
      if (res.status === 402)
        throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
      const t = await res.text();
      console.error("AI gateway error:", res.status, t);
      throw new Error("AI service error. Please try again.");
    }

    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("AI did not return a valid response");

    let parsed: TailorResult;
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      throw new Error("Failed to parse AI response");
    }
    return {
      resume: parsed.resume ?? "",
      keywords: parsed.keywords ?? [],
      improvements: parsed.improvements ?? [],
      coverLetter: parsed.coverLetter ?? "",
    };
  });
