import { z } from "zod";

export const campaignSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  kind: z.enum(["campaign", "one-shot"]),
  description: z.string().max(10000),
  rules: z.object({
    edition: z.literal("2014"),
    extraFeat: z.boolean(),
    sources: z.object({
      official2014: z.boolean(),
      homebrew: z.boolean(),
    }),
    sourceNotes: z.string().max(10000),
  }),
});
export type Campaign = z.infer<typeof campaignSchema>;
export function makeCampaign(id: string, name: string): Campaign {
  return {
    id,
    name,
    kind: "campaign",
    description: "",
    rules: {
      edition: "2014",
      extraFeat: false,
      sources: { official2014: true, homebrew: false },
      sourceNotes: "",
    },
  };
}

export function campaignLabel(campaign: Campaign, campaigns: Campaign[]) {
  const duplicates = campaigns.filter((c) => c.name === campaign.name);
  const suffix =
    duplicates.length > 1
      ? ` · ${duplicates.findIndex((c) => c.id === campaign.id) + 1}`
      : "";
  return `${campaign.name}${suffix} · ${campaign.kind === "one-shot" ? "Ваншот" : "Кампания"}`;
}
