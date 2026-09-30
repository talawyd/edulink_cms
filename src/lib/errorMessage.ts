// Supabase errors (PostgrestError, AuthError from some code paths) are not
// always real Error instances — they can be plain { message, code, ... }
// objects, so `e instanceof Error` silently fails and falls through to
// `String(e)`, producing "[object Object]". Check for a string .message
// before giving up.
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message
  }
  return String(e)
}
