import { z } from "zod";

export const experimentSchema = z
  .strictObject({
    experimentGoal: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .nullable(),

    experimentResult: z
      .string()
      .trim()
      .min(1)
      .max(3000)
      .nullable(),

    experimentStatus: z.enum([
      "NOT_TESTED",
      "SUCCESS",
      "FAILED",
    ]),
  })
  .refine(
    (data) =>
      data.experimentStatus === "NOT_TESTED" ||
      data.experimentResult !== null,
    {
      message:
        "Tested experiments must include a result.",
      path: ["experimentResult"],
    }
  );

export type ExperimentInput = z.infer<
  typeof experimentSchema
>;
