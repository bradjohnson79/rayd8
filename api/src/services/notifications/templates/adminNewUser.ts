import type { AdminNewUserPayload, UserCreatedPayload } from '../notificationEvents.js'
import { getRayd8Url, renderInfoCard, renderKeyValueTable, renderParagraph, renderRayd8Email, text } from './base.js'

export function renderAdminNewUserTemplate(payload: AdminNewUserPayload) {
  const subject = `New RAYD8 user created: ${payload.email}`
  const html = renderRayd8Email({
    eyebrow: 'Admin Alert',
    title: 'A new user joined RAYD8',
    intro: 'A new account has been created and is ready for admin review if needed.',
    sections: [
      renderInfoCard(
        'User details',
        renderKeyValueTable([
          { label: 'User ID', value: payload.userId },
          { label: 'Email', value: payload.email },
          { label: 'Name', value: text(payload.name, 'Not provided') },
        ]),
      ),
    ],
    callToAction: {
      label: 'Open Admin Dashboard',
      url: getRayd8Url('/admin/subscribers'),
    },
  })

  return { html, subject }
}

export function renderUserCreatedTemplate(payload: UserCreatedPayload) {
  const subject = 'Welcome to RAYD8'
  const html = renderRayd8Email({
    eyebrow: 'Account Created',
    title: 'Your account is ready',
    intro: 'Welcome to RAYD8. Your dashboard is available now and you can begin streaming immediately based on your current access level.',
    sections: [
      renderParagraph('Start with the Instructions page if you want a calm overview before your first session.'),
      renderInfoCard(
        'Account details',
        renderKeyValueTable([
          { label: 'Email', value: payload.email },
          { label: 'User ID', value: payload.userId },
          { label: 'Name', value: text(payload.name, 'Not provided') },
        ]),
      ),
    ],
    callToAction: {
      label: 'Open Dashboard',
      url: getRayd8Url('/dashboard'),
    },
  })

  return { html, subject }
}
