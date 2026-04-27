const sourceOfTruthAdminEmails = new Set(
  (import.meta.env.VITE_SOURCE_OF_TRUTH_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean),
)

export function isSourceOfTruthAdminEmail(email: string | null | undefined) {
  if (!email) {
    return false
  }

  return sourceOfTruthAdminEmails.has(email.toLowerCase())
}
