import { z } from "zod";

export const SUBSCRIPTION_STATUSES = ["trial", "active", "past_due", "suspended", "cancelled"] as const;

export const uuidSchema = z.uuid();

const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide"));

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Couleur hexadécimale attendue (#RRGGBB)");

export const merchantCreateSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(120),
  category: z.string().trim().min(2, "Catégorie trop courte").max(60),
  win_rate: z.coerce.number().min(0).max(100),
  reward_description: z.string().trim().min(2, "Récompense trop courte").max(160),
  subscription_status: z.enum(SUBSCRIPTION_STATUSES),
  stamps_goal: z.coerce.number().int().min(1).max(50),
  brand_color: hexColor,
});

export const merchantSettingsSchema = z.object({
  reward_description: z.string().trim().min(2, "Récompense trop courte").max(160),
  stamps_goal: z.coerce.number().int().min(1).max(50),
  brand_color: hexColor,
});

export const batchCreateSchema = z.object({
  merchant_id: uuidSchema,
  quantity: z.coerce.number().int().min(1, "Minimum 1").max(5000, "Maximum 5000"),
  label: z.string().trim().max(80).default(""),
});

export const inviteSchema = z.object({
  merchant_id: uuidSchema,
  email: emailSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Mot de passe requis"),
});

export const passwordSchema = z
  .object({
    password: z.string().min(10, "10 caractères minimum").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Les mots de passe ne correspondent pas", path: ["confirm"] });

export const redemptionCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/, "Code à 6 caractères (sans I, O, 0, 1)");

/** Flattens zod issues into a single readable message for form feedback. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Données invalides";
}
