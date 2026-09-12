# Remote platform login

Status: implemented

## User behavior and ownership

The settings dialog displays the selected platform's dedicated browser tab and forwards bounded pointer, wheel, text and key messages through administrator-only HTTP routes. Login profiles remain shared Host resources under the existing source policy. Ordinary accounts cannot view screenshots or inject input. No cookie export, arbitrary CDP transport, address bar or script evaluation is exposed. Google/Apple popup login is outside the selected platform tab; phone, email, username and QR workflows use the displayed page.

SessionManager owns the login task, remote capability, deadlines and browser lifetime. One platform has at most one login operation. Reopening reuses its capability; a stale close request cannot stop a newer login. Closing revokes input before awaiting issued commands, aborting login and stopping the browser. Heartbeat loss and the absolute deadline also stop the browser. Profile data persists after closing. A concurrent search cannot switch an active remote login into headless mode.

RemoteLoginSession restricts capture and input to the selected platform tab, verifies its current URL before and after capture, bounds input and queue size, coalesces capture, and clears screenshots on completion. Responses use no-store. The browser view keeps only the latest frame and clears submitted text. Linux deployment uses a private Xvfb display, Xauthority and Chrome's normal sandbox; no public debugging or desktop port is added.

Active-browser status checks capture the browser instance before awaiting authentication and publish their result only while that same instance remains current. A disconnected, stopped or replaced browser cannot overwrite profile metadata or provide authentication for its successor; the status response reports the current browser as unverified.

## Validation

Unit and route tests cover input translation, bounds, platform URLs, authentication, no-store, deadline decisions, close versus input races and stale IDs. Deferred authentication probes exercise status requests overlapping explicit stop, connection loss and replacement; expected output records the resulting unverified status and metadata remains unchanged. Lifecycle tests use isolated profiles and fake browser processes. Browser/UI and server probes use task-owned profiles and never submit platform credentials. Real account authentication remains a user action.

The bridge uses the documented [Page capture API](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot) and [Input API](https://chromedevtools.github.io/devtools-protocol/tot/Input/).
