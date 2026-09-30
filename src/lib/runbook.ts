export const CODE_PATTERN = /^[a-z][a-z0-9]{1,29}$/
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeSql(value: string) {
  return value.replace(/'/g, "''")
}

export function generatePassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export function schoolSettingsSql(code: string, name: string) {
  return `insert into public.school_settings (school_code, school_name) values ('${escapeSql(code)}', '${escapeSql(name)}');`
}

export function firstAdminSql(email: string, fullName: string, createdBy: string) {
  const e = escapeSql(email)
  return [
    `insert into public.profiles (user_id, full_name)`,
    `select id, '${escapeSql(fullName)}' from auth.users where email = '${e}';`,
    ``,
    `insert into public.user_roles (user_id, role, created_by)`,
    `select id, 'admin', '${escapeSql(createdBy)}' from auth.users where email = '${e}';`,
  ].join('\n')
}

export function licenceRowSql(expiresOn: string, graceDays: number, signingSecret: string) {
  return `insert into public.license (expires_on, grace_days, signing_secret) values ('${escapeSql(expiresOn)}', ${graceDays}, '${escapeSql(signingSecret)}');`
}

export function rotateSecretSql(signingSecret: string) {
  return `update public.license set signing_secret = '${escapeSql(signingSecret)}';`
}

export function forgottenPasswordSql(email: string, tempPassword: string) {
  return `update auth.users set encrypted_password = crypt('${escapeSql(tempPassword)}', gen_salt('bf')), raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"must_change_password": true}'::jsonb, updated_at = now() where email = '${escapeSql(email)}';`
}
