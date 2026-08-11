import type { NextFunction, Request, Response } from "express";

type ValidationResult =
  | { success: true; data: unknown }
  | {
      success: false;
      error: { issues: Array<{ path: PropertyKey[]; message: string }> };
    };

type Schema = { safeParse(value: unknown): ValidationResult };
type RequestPart = "body" | "params" | "query";

/** Validates requests from the generated OpenAPI/Zod contract. */
export function validate(part: RequestPart, schema: Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      res.status(400).json({
        error: "Dados da requisição inválidos",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }
    next();
  };
}
