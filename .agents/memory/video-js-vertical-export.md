---
name: video-js vertical / aspect-ratio export
description: How to produce non-16:9 (e.g. 9:16 Instagram Reels) videos with the video-js skill
---

# video-js aspect ratio is fixed at 16:9 by the export pipeline

The video-js recording/export pipeline (`window.startRecording`/`stopRecording`, injected by the
Replit preview infra — NOT in the repo) captures the app **viewport at 16:9**. There is no repo-side
knob to make a native 9:16 (or 1:1, 4:5) export.

**Why:** the skill states videos are "composed for 16:9"; the root container is `w-full h-screen`
and the recorder captures that viewport. Nothing in `src/lib/video/hooks.ts` or `artifact.toml`
controls output dimensions.

**How to apply (vertical Reel workaround):** build a centered inner "stage" of the target aspect
(e.g. `h-full aspect-[9/16]` centered with flex) that holds ALL scene content, and fill the
surrounding 16:9 area with an extension of the video's OWN background (brand gradient/texture),
never black bars — so the captured 16:9 frame still reads as intentional and the center crops
cleanly to 9:16. Keep key text ~14% from top/bottom for Instagram UI safe zones. The user then
crops/positions to the center 9:16 in Instagram's uploader (or any editor) for a true full-screen Reel.

**Containment gotcha:** when re-laying-out horizontal scenes to vertical, `vh` refers to the full
viewport height (= stage height since stage is `h-full`). Naive stacks (large `py-[15vh]` +
`h-[40vh]` image + multi-line `vh` headings + lists) easily exceed 100vh and clip. Use
`justify-center`, modest `py-[~9vh]`, `gap-[Nvh]`, `flex-shrink-0`, and smaller stage-relative sizes.
