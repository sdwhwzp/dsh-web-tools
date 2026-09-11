# Platform login feedback on remote deployments

Status: implemented

## Behavior

Native X and Xiaohongshu login opens a window on the Host. Server 30 has no supported browser and its service has no DISPLAY or WAYLAND_DISPLAY. Returning login-pending before checking these prerequisites made the settings button appear unresponsive. Login now rejects missing prerequisites with HTTP 409 and a locale-owned reason next to the platform control. The page explains where the window opens; remote desktop access is not implemented by this change.

SessionManager owns one pending login per platform and retains its failure for status polling. The pending flag covers manual interaction after browser startup, so a ready but signed-out browser still polls every two seconds. Retry clears the prior error; stop aborts the login and waits for its operation lease to be released; resetting a session clears the error. Existing platform profiles remain browser-managed and shared only according to deployment policy.

## Verification

Focused tests cover prerequisite rejection, duplicate login requests, retained startup failures, retry/reset, browser lifecycle and polling. The owner-local bilingual presentation snapshot records the messages for absent browsers, absent displays and pending login. Production verification must check both platform login routes through the administrator gateway and confirm ordinary accounts cannot manage shared logins.
