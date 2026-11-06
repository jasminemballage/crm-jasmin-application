import { DomainError } from "../domain";

/** Only CRM destinations may be used after authentication. */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  return /^\/(?:catalogue|stocks|commandes|expeditions|connexions|parametres)?$/.test(value) || /^\/preparation\/[a-zA-Z0-9_-]+$/.test(value) ? value : "/";
}

type AuthClient = { auth: { getUser(): PromiseLike<{ data: { user: { id: string; email?: string; is_anonymous?: boolean } | null }; error: unknown }> } };
type MembershipLookup = (id: string) => PromiseLike<{ data: { enabled: boolean } | null; error: unknown }>;

/** Never use getSession as an authorization decision: getUser validates with Auth. */
export async function verifyCrmMember(client: AuthClient, membership: MembershipLookup) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) throw new DomainError("Connectez-vous pour accéder à votre espace.", 401);
  const member = await membership(data.user.id);
  if (member.error) throw new DomainError("La vérification des accès est indisponible.", 503);
  if (!member.data?.enabled) throw new DomainError("Ce compte n’a pas accès à l’espace Jasmin.", 403);
  return data.user;
}
