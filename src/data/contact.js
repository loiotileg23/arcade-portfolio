// Contact details used by the GET IN TOUCH modal. Edit here only.

export const EMAIL        = 'hello@appsarchitects.com'
export const LINKEDIN_URL = 'https://www.linkedin.com/in/giancarloloiotile'

const mailto = (subject) => `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}`

export const RESUME_MAILTO  = mailto('Resume Request — The Visionary Project')
export const INQUIRY_MAILTO = mailto('Professional Inquiry — The Visionary Project')
