function mailto(to: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function keyEmail(schoolName: string, contactEmail: string, expiresOn: string, key: string) {
  const subject = `${schoolName} — your new activation key`
  const body = [
    `Hi,`,
    ``,
    `Here is the new activation key for ${schoolName}. It extends your subscription to ${expiresOn}.`,
    ``,
    key,
    ``,
    `Log in as your school administrator, open Settings, then Activation key. If your subscription has already expired you will be taken straight to the activation page. Enter the key there.`,
    ``,
    `Please keep this key private.`,
  ].join('\n')
  return mailto(contactEmail, subject, body)
}

export function reminderEmail(schoolName: string, contactEmail: string, expiresOn: string) {
  const subject = `${schoolName} — your subscription is coming up for renewal`
  const body = [
    `Hi,`,
    ``,
    `This is a reminder that ${schoolName}'s subscription ends on ${expiresOn}. A new activation key will follow shortly.`,
  ].join('\n')
  return mailto(contactEmail, subject, body)
}
