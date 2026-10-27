# Meridian desktop changelog

User-facing release notes. When you publish (`bun publish:desktop`) without
passing notes, the section whose heading matches the version being released
becomes the update's `notes` in latest.json, and the app shows it under
"What's new" before the user downloads the update.

Format: one `## X.Y.Z` heading per release (anything after the version, like a
date, is ignored), then `- ` bullets. `### Heading` lines group bullets.
Write for users, not developers.

## 1.0.1

- Meridian no longer signs you out or shows a blank screen after your Mac wakes from sleep.
- Habit cards show your last 7 days, so your progress doesn't start over every Monday.
- The update prompt now shows what's new before you download.
- Fixed the date highlight being cut off when typing a date at the start of a todo title.
- Buttons in dialogs no longer show a focus outline when you use the mouse. Keyboard users still see it.
