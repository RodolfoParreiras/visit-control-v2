export type VisitorSnapshot = {
  name: string | null;
  cpf: string;
  phone: string | null;
  company: string | null;
  city: string | null;
};

type VisitorData = {
  name: string;
  cpf: string;
  phone: string | null;
  company: string | null;
  city: string | null;
};

/**
 * Returns the visitor data recorded at check-in. Old visits without a
 * snapshot continue to fall back to the current visitor profile.
 */
export function resolveVisitorSnapshot<T extends VisitorData>(
  visitor: T,
  snapshot: VisitorSnapshot,
): T {
  if (snapshot.name === null) return visitor;
  return {
    ...visitor,
    name: snapshot.name,
    cpf: snapshot.cpf,
    phone: snapshot.phone,
    company: snapshot.company,
    city: snapshot.city,
  };
}
