# Invader Break design worklog

Research date: 2026-09-16. Scope: research, game design, graphic concepts, and development planning only. No implementation.

- [x] Classify as architectural design and inspect the empty project.
- [x] Read Superpowers workflow, brainstorming, parallel research, and planning instructions.
- [x] Ask optional launch-platform preference; proceed with desktop-first assumption if unanswered.
- [x] Inspect Motion Fighter's camera and hand landmark pipeline.
- [x] Locate and read the referenced development rules or document the unavailable path.
- [x] Research gameplay precedents and current primary technical sources.
- [x] Compare design/rendering approaches and select a recommendation.
- [x] Create and inspect graphic concepts and art production guidance.
- [x] Write a coherent game specification and staged development plan.
- [x] Review requirements, source provenance, internal consistency, and artifact links.
- [x] Prepare the package for delivery and review. Implementation remains outside this request.

The requested written design and development plan are the deliverables of this task. They are proposals for review, not an approved implementation specification. No section-by-section approval or implementation handoff is needed to complete these requested planning artifacts.

## Review and verification

Used the verification-before-completion workflow. Independent read-only reviews covered gameplay, hand tracking and development provenance; the main agent also reviewed specification coverage and internal links.

Resolved consequential findings: union-surface rebound aiming; grace-period hazard disposal; a continuously visible paddle face during damage; permitted tactical reconfiguration and separate local records; revalidation of in-flight threats; micro-pause limits and no countdown on a single missed frame; authoritative timing clocks; one shared calibration range; source-coordinate mapping separate from preview crop; measurable tracking-failure signals; an early ten-person graybox gate; explicit baseline browser/device coverage; actual Safari qualification; current SDK telemetry documentation; lifecycle camera release; consented external timing footage; and release asset/name rights review.

The two generated PNGs were visually inspected. They show the intended materials and playfield hierarchy and are labeled as concepts. Their illustrative counters and proportions are subordinate to the specification.

Local Markdown links and PNG headers were checked. New files are documents/images only. No application build, runtime test, camera trial or participant study was performed; those are future plan tasks. No commit, push or deployment was performed.

Open design assumptions remain explicitly labeled: desktop-first launch, ball-drain shield damage, session duration, visual target and staffing estimate. The missing original development rules are recorded without a conformity claim.
